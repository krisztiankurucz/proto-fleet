import ButtonPanel from "../ButtonPanel/ButtonPanel";
import LedPanel from "../LedPanel/LedPanel";

function IoPanel() {
  return (
    <div className="flex flex-col gap-6">
      <LedPanel />
      <ButtonPanel />
    </div>
  );
}

export default IoPanel;
