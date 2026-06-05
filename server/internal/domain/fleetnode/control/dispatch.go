package control

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"connectrpc.com/connect"

	gatewaypb "github.com/block/proto-fleet/server/generated/grpc/fleetnodegateway/v1"
	"github.com/block/proto-fleet/server/internal/domain/fleeterror"
)

// Sender dispatches one command to a node's ControlStream. *Registry implements it.
type Sender interface {
	Send(ctx context.Context, fleetNodeID int64, cmd *gatewaypb.ControlCommand, scope ReportScope, kind ReportKind, pair *PairMeta) (*Session, error)
}

// RunCommand dispatches cmd to fleetNodeID, drains its result events through
// onData until a terminal ack, and maps the outcome to an error. It owns the
// send/timeout/cancel/stream-drop loop shared by server-initiated discovery and
// pairing. kind tags which gateway report RPC may admit reports for this command;
// pair is non-nil only for pairing (carries operator context + target set for
// gateway-side persistence); noun names the command in error messages.
//
// onData handles the data events (CommandEvent.Batch / .PairResults) and returns
// terminal=true to stop early (e.g. the operator stream is gone); the terminal
// ack is handled here. RunCommand returns nil on an OK or PARTIAL ack and an
// error otherwise (including any error onData returns).
func RunCommand(ctx context.Context, sender Sender, fleetNodeID int64, cmd *gatewaypb.ControlCommand, scope ReportScope, kind ReportKind, pair *PairMeta, timeout time.Duration, noun string, onData func(CommandEvent) (terminal bool, err error)) error {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	session, err := sender.Send(ctx, fleetNodeID, cmd, scope, kind, pair)
	if err != nil {
		if errors.Is(err, ErrNoActiveStream) {
			return fleeterror.NewFailedPreconditionError("fleet node has no active control stream")
		}
		return err
	}
	defer session.Close()

	handleEvent := func(ev CommandEvent) (terminal bool, err error) {
		if ev.Ack != nil {
			// PARTIAL carries succeeded=false but its results already streamed;
			// treat it as a usable (incomplete) result, not a failure.
			if ev.Ack.GetCode() == gatewaypb.AckCode_ACK_CODE_PARTIAL {
				slog.Warn("fleet node command completed partially",
					"fleet_node_id", fleetNodeID, "command", noun, "detail", ev.Ack.GetErrorMessage())
				return true, nil
			}
			// Require the structured OK code, not just the boolean, so an
			// inconsistent ack (succeeded=true with a non-OK/unset code) can't
			// pass a failed command off as success.
			if ev.Ack.GetCode() != gatewaypb.AckCode_ACK_CODE_OK || !ev.Ack.GetSucceeded() {
				return true, AckFailure(ev.Ack, noun)
			}
			return true, nil
		}
		return onData(ev)
	}

	events := session.Events()
	for {
		select {
		case <-ctx.Done():
			if errors.Is(ctx.Err(), context.DeadlineExceeded) {
				return connect.NewError(connect.CodeDeadlineExceeded, fmt.Errorf("%s command timed out after %s", noun, timeout))
			}
			// Caller (operator or fan-out) cancelled; report it as such rather
			// than a server-side Internal failure.
			return fleeterror.NewCanceledError()
		case ev := <-events:
			if terminal, err := handleEvent(ev); terminal {
				return err
			}
		case <-session.Done():
			// Stream died before an ack. Drain buffered events first (a final ack
			// or last batch) so select randomness doesn't drop them.
			for {
				select {
				case ev := <-events:
					if terminal, err := handleEvent(ev); terminal {
						return err
					}
				default:
					return fleeterror.NewFailedPreconditionError("fleet node control stream closed before command completed")
				}
			}
		}
	}
}

// AckFailure maps a non-OK terminal ack to an operator-facing error, even when
// error_message is empty. The structured AckCode drives the gRPC code so a
// retryable condition (BUSY) and a capability gap (AGENT_INCAPABLE) are
// distinguishable from a malformed request (BAD_REQUEST); anything else is an
// opaque Internal failure. noun names the command in the message.
func AckFailure(ack *gatewaypb.ControlAck, noun string) error {
	reason := ack.GetErrorMessage()
	if reason == "" {
		reason = "code " + ack.GetCode().String()
	}
	// if/else (not switch) so the exhaustive linter doesn't demand a case per
	// AckCode; everything outside the cases below is an opaque Internal failure.
	code := ack.GetCode()
	if code == gatewaypb.AckCode_ACK_CODE_BAD_REQUEST {
		return fleeterror.NewInvalidArgumentErrorf("fleet node rejected %s command: %s", noun, reason)
	}
	if code == gatewaypb.AckCode_ACK_CODE_BUSY {
		return fleeterror.NewPlainError(
			fmt.Sprintf("fleet node is busy with another command; retry shortly: %s", reason),
			connect.CodeResourceExhausted,
		)
	}
	if code == gatewaypb.AckCode_ACK_CODE_AGENT_INCAPABLE {
		return fleeterror.NewFailedPreconditionErrorf("fleet node cannot service this %s command; try another node: %s", noun, reason)
	}
	if code == gatewaypb.AckCode_ACK_CODE_REPORT_FAILED {
		return fleeterror.NewInternalErrorf("fleet node could not upload all %s results; some may have been applied, re-list to confirm: %s", noun, reason)
	}
	return fleeterror.NewInternalErrorf("fleet node reported %s failure: %s", noun, reason)
}
