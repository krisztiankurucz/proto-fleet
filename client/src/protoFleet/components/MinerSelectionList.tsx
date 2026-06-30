import {
  forwardRef,
  type ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { clone, create } from "@bufbuild/protobuf";

import {
  SortConfigSchema,
  SortDirection as SortDirectionProto,
  SortField,
} from "@/protoFleet/api/generated/common/v1/sort_pb";
import type { DeviceSet } from "@/protoFleet/api/generated/device_set/v1/device_set_pb";
import type { MinerStateSnapshot as ProtoMinerStateSnapshot } from "@/protoFleet/api/generated/fleetmanagement/v1/fleetmanagement_pb";
import {
  type MinerListFilter,
  MinerListFilterSchema,
  PairingStatus,
} from "@/protoFleet/api/generated/fleetmanagement/v1/fleetmanagement_pb";
import { useSites } from "@/protoFleet/api/sites";
import { useDeviceSets } from "@/protoFleet/api/useDeviceSets";
import useFleet from "@/protoFleet/api/useFleet";
import type { SiteFilterFields } from "@/protoFleet/components/PageHeader/SitePicker";
import { INACTIVE_PLACEHOLDER } from "@/protoFleet/features/fleetManagement/components/MinerList/constants";
import { getMinerGroupLabels, getMinerRackLabel } from "@/protoFleet/features/fleetManagement/utils/minerPlacement";

import { ChevronDown } from "@/shared/assets/icons";
import Button, { sizes, variants } from "@/shared/components/Button";
import List from "@/shared/components/List";
import type { ActiveFilters, FilterItem } from "@/shared/components/List/Filters/types";
import type { ColConfig, ColTitles, SortDirection } from "@/shared/components/List/types";
import { ModalSelectAllFooter } from "@/shared/components/Modal";
import ProgressCircular from "@/shared/components/ProgressCircular";

// --- Exported types ---

export type DeviceListItem = {
  deviceIdentifier: string;
  name: string;
  manufacturer: string;
  model: string;
  ipAddress: string;
  rackLabel: string;
  groupLabels: string[];
};

export type FilterConfig = {
  showTypeFilter?: boolean;
  showRackFilter?: boolean;
  showGroupFilter?: boolean;
  showSiteFilter?: boolean;
};

export interface MinerSelectionListHandle {
  getSelection: () => {
    selectedItems: string[];
    allSelected: boolean;
    totalMiners: number | undefined;
    filter: MinerListFilter;
  };
}

export interface MinerSelectionListProps {
  filterConfig?: FilterConfig;
  initialAllSelected?: boolean;
  fixedModels?: string[];
  initialSelectedItems?: string[];
  isMembersLoading?: boolean;
  isRowDisabled?: (item: DeviceListItem) => boolean;
  isRowVisible?: (item: DeviceListItem) => boolean;
  noDataElement?: ReactNode;
  visibleTotal?: number;
  /** When true, renders radio buttons for single-item selection instead of checkboxes. */
  singleSelect?: boolean;
  disableFilteredSelectAll?: boolean;
  showSelectAllFooter?: boolean;
  // Soft default from the topbar SitePicker. A single selected site limits the
  // miner list and its rack facet options to that site; "all sites" passes the
  // empty filter and shows everything (no regression). Folded into the
  // MinerListFilter (AND with the user's model/rack/group facets) so applying a
  // facet never drops the site scope.
  scope?: SiteFilterFields;
  onSelectionChange?: (state: {
    selectedItems: string[];
    allSelected: boolean;
    totalMiners: number | undefined;
  }) => void;
}

// --- Constants ---

const modalCols = {
  name: "name",
  type: "type",
  rack: "rack",
  ipAddress: "ipAddress",
  group: "group",
} as const;

type ModalColumn = (typeof modalCols)[keyof typeof modalCols];

const modalColTitles: ColTitles<ModalColumn> = {
  name: "Name",
  type: "Model",
  rack: "Rack",
  ipAddress: "IP address",
  group: "Group",
};

const activeCols: ModalColumn[] = [
  modalCols.name,
  modalCols.type,
  modalCols.rack,
  modalCols.ipAddress,
  modalCols.group,
];

const modalColConfig: ColConfig<DeviceListItem, string, ModalColumn> = {
  [modalCols.name]: {
    component: (device: DeviceListItem) => <span>{device.name || device.deviceIdentifier}</span>,
    width: "min-w-28",
  },
  [modalCols.type]: {
    component: (device: DeviceListItem) => <span>{device.model || INACTIVE_PLACEHOLDER}</span>,
    width: "min-w-20",
  },
  [modalCols.rack]: {
    component: (device: DeviceListItem) => <span>{device.rackLabel || INACTIVE_PLACEHOLDER}</span>,
    width: "min-w-28",
  },
  [modalCols.ipAddress]: {
    component: (device: DeviceListItem) => <span>{device.ipAddress || INACTIVE_PLACEHOLDER}</span>,
    width: "min-w-24",
  },
  [modalCols.group]: {
    component: (device: DeviceListItem) => {
      const label = device.groupLabels.length > 0 ? device.groupLabels.join(", ") : INACTIVE_PLACEHOLDER;
      return <span title={label}>{label}</span>;
    },
    width: "min-w-24 max-w-48",
  },
};

/** Columns that support server-side sorting, mapped to their proto SortField. */
const SORT_FIELD_BY_COLUMN: Partial<Record<ModalColumn, SortField>> = {
  [modalCols.name]: SortField.NAME,
  [modalCols.type]: SortField.MODEL,
  [modalCols.ipAddress]: SortField.IP_ADDRESS,
};

const ALL_SORTABLE_COLUMNS = new Set<ModalColumn>(Object.keys(SORT_FIELD_BY_COLUMN) as ModalColumn[]);

const PAGE_SIZE = 50;
const UNASSIGNED_SITE_FILTER_ID = "__unassigned";

const hasUnsupportedAllSelectionFilter = (filter: MinerListFilter): boolean =>
  filter.models.length > 0 ||
  filter.rackIds.length > 0 ||
  filter.groupIds.length > 0 ||
  filter.siteIds.length > 0 ||
  filter.includeUnassigned;

const toDeviceListItem = (miner: ProtoMinerStateSnapshot): DeviceListItem => ({
  deviceIdentifier: miner.deviceIdentifier,
  name: miner.name,
  manufacturer: miner.manufacturer,
  model: miner.model,
  ipAddress: miner.ipAddress,
  rackLabel: getMinerRackLabel(miner),
  groupLabels: getMinerGroupLabels(miner),
});

// --- Component ---

const MinerSelectionList = forwardRef<MinerSelectionListHandle, MinerSelectionListProps>(
  (
    {
      filterConfig,
      initialAllSelected = false,
      fixedModels,
      initialSelectedItems,
      isMembersLoading = false,
      isRowDisabled,
      isRowVisible,
      noDataElement,
      singleSelect = false,
      disableFilteredSelectAll = false,
      showSelectAllFooter = true,
      scope,
      visibleTotal,
      onSelectionChange,
    },
    ref,
  ) => {
    const {
      showTypeFilter = true,
      showRackFilter = true,
      showGroupFilter = true,
      showSiteFilter = false,
    } = filterConfig ?? {};

    const scopeSiteIds = useMemo(() => scope?.siteIds ?? [], [scope]);
    const scopeIncludeUnassigned = scope?.includeUnassigned ?? false;
    // Serialized key so effects/callbacks only re-fire when the selection
    // actually changes (siteIds is a fresh bigint[] each render otherwise).
    const scopeKey = `${scopeSiteIds.map(String).join(",")}|${scopeIncludeUnassigned}`;

    const { listGroups, listRacks } = useDeviceSets();
    const [filter, setFilter] = useState(() =>
      create(MinerListFilterSchema, {
        models: fixedModels ?? [],
        siteIds: scopeSiteIds,
        includeUnassigned: scopeIncludeUnassigned,
      }),
    );
    const { listSites } = useSites();
    const [selectedItems, setSelectedItems] = useState<string[]>(initialSelectedItems ?? []);
    const [allSelected, setAllSelected] = useState(initialAllSelected && !singleSelect);
    const [availableGroups, setAvailableGroups] = useState<DeviceSet[]>([]);
    const [availableRacks, setAvailableRacks] = useState<DeviceSet[]>([]);
    const [availableSites, setAvailableSites] = useState<{ id: bigint; name: string }[]>([]);
    const [hasInitialSynced, setHasInitialSynced] = useState(!initialSelectedItems || initialSelectedItems.length > 0);
    const [currentSort, setCurrentSort] = useState<{ field: ModalColumn; direction: SortDirection } | undefined>(
      undefined,
    );

    // Build proto SortConfig from the current UI sort state
    const sortConfig = useMemo(() => {
      if (!currentSort) return undefined;
      const protoField = SORT_FIELD_BY_COLUMN[currentSort.field];
      if (!protoField) return undefined;
      return create(SortConfigSchema, {
        field: protoField,
        direction: currentSort.direction === "asc" ? SortDirectionProto.ASC : SortDirectionProto.DESC,
      });
    }, [currentSort]);

    const {
      minerIds,
      miners,
      totalMiners,
      isLoading,
      hasMore,
      currentPage,
      hasPreviousPage,
      goToNextPage,
      goToPrevPage,
      availableModels,
    } = useFleet({
      filter,
      sort: sortConfig,
      pageSize: PAGE_SIZE,
      pairingStatuses: [PairingStatus.PAIRED],
    });

    const currentPageItems = useMemo(() => {
      if (!miners) return [];
      return minerIds
        .map((id) => miners[id])
        .filter((snapshot): snapshot is ProtoMinerStateSnapshot => Boolean(snapshot))
        .map(toDeviceListItem)
        .filter((item) => (isRowVisible ? isRowVisible(item) : true));
    }, [isRowVisible, minerIds, miners]);

    const displayedTotalMiners = visibleTotal ?? totalMiners;
    const currentSelectableItemIds = useMemo(
      () =>
        (isRowDisabled ? currentPageItems.filter((device) => !isRowDisabled(device)) : currentPageItems).map(
          (device) => device.deviceIdentifier,
        ),
      [currentPageItems, isRowDisabled],
    );
    const displayedSelectedItems = allSelected && !singleSelect ? currentSelectableItemIds : selectedItems;
    const canSelectAll = !singleSelect && (!disableFilteredSelectAll || !hasUnsupportedAllSelectionFilter(filter));
    const shouldShowSelectionFooter =
      showSelectAllFooter &&
      totalMiners !== undefined &&
      totalMiners > 0 &&
      !singleSelect &&
      (canSelectAll || allSelected || selectedItems.length > 0);

    const handleSort = useCallback((field: ModalColumn, direction: SortDirection) => {
      setCurrentSort({ field, direction });
    }, []);

    const scrollRef = useRef<HTMLDivElement>(null);
    const currentPageItemsRef = useRef(currentPageItems);
    useEffect(() => {
      currentPageItemsRef.current = currentPageItems;
    }, [currentPageItems]);

    const scrollToTop = useCallback(() => {
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }, []);

    // Sync initialSelectedItems when they arrive asynchronously (edit mode).
    // Uses queueMicrotask to avoid synchronous setState inside effect body.
    useEffect(() => {
      if (hasInitialSynced) return;
      if (initialSelectedItems && initialSelectedItems.length > 0) {
        queueMicrotask(() => {
          setSelectedItems(initialSelectedItems);
          setHasInitialSynced(true);
        });
      }
    }, [initialSelectedItems, hasInitialSynced]);

    // Notify parent of selection changes
    useEffect(() => {
      onSelectionChange?.({ selectedItems, allSelected, totalMiners: displayedTotalMiners });
    }, [selectedItems, allSelected, displayedTotalMiners, onSelectionChange]);

    useEffect(() => {
      if (!allSelected || canSelectAll) {
        return;
      }
      setAllSelected(false);
      setSelectedItems([]);
    }, [allSelected, canSelectAll]);

    // Expose selection state to parent via imperative handle
    useImperativeHandle(
      ref,
      () => ({
        getSelection: () => ({ selectedItems, allSelected, totalMiners: displayedTotalMiners, filter }),
      }),
      [selectedItems, allSelected, displayedTotalMiners, filter],
    );

    const handleSetSelectedItems = useCallback(
      (newSelection: string[]) => {
        setAllSelected(false);
        if (singleSelect) {
          // In single-select mode, just keep the selected item (no off-page merging)
          setSelectedItems(newSelection.slice(0, 1));
        } else {
          setSelectedItems((prev) => {
            const currentPageKeys = new Set(currentPageItemsRef.current.map((d) => d.deviceIdentifier));
            const offPageSelections = prev.filter((id) => !currentPageKeys.has(id));
            return [...offPageSelections, ...newSelection.filter((id) => currentPageKeys.has(id))];
          });
        }
      },
      [singleSelect],
    );

    const handleNextPage = useCallback(() => {
      scrollToTop();
      goToNextPage();
    }, [scrollToTop, goToNextPage]);

    const handlePrevPage = useCallback(() => {
      scrollToTop();
      goToPrevPage();
    }, [scrollToTop, goToPrevPage]);

    // Keep the active site scope folded into the filter when the selection
    // changes mid-modal. Preserves the user's model/rack/group facets and only
    // swaps the site fields.
    useEffect(() => {
      setFilter((current) => {
        if (
          current.siteIds.map(String).join(",") === scopeSiteIds.map(String).join(",") &&
          current.includeUnassigned === scopeIncludeUnassigned
        ) {
          return current;
        }
        // Clone to preserve the user's model/rack/group facets, swapping only
        // the site fields.
        const next = clone(MinerListFilterSchema, current);
        next.siteIds = scopeSiteIds;
        next.includeUnassigned = scopeIncludeUnassigned;
        return next;
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scopeKey]);

    // Fetch filter options only for enabled filters. Rack facet options scope
    // to the active site so the dropdown lists only the site's racks; group
    // options stay org-wide until ListGroups gains site filtering (issue #520).
    useEffect(() => {
      if (showGroupFilter) listGroups({ onSuccess: setAvailableGroups });
      if (showRackFilter)
        listRacks({ siteIds: scopeSiteIds, includeUnassigned: scopeIncludeUnassigned, onSuccess: setAvailableRacks });
      if (showSiteFilter) {
        void listSites({
          onSuccess: (siteCounts) => {
            setAvailableSites(
              siteCounts.flatMap((siteWithCounts) => {
                const site = siteWithCounts.site;
                return site ? [{ id: site.id, name: site.name }] : [];
              }),
            );
          },
        });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showGroupFilter, showRackFilter, showSiteFilter, listGroups, listRacks, listSites, scopeKey]);

    const filters = useMemo((): FilterItem[] => {
      const items: FilterItem[] = [];
      if (showTypeFilter) {
        items.push({
          type: "dropdown",
          title: "Model",
          value: "type",
          options: availableModels.map((model) => ({ id: model, label: model })),
          defaultOptionIds: [],
        });
      }
      if (showRackFilter) {
        items.push({
          type: "dropdown",
          title: "Rack",
          value: "rack",
          options: availableRacks.map((rack) => ({ id: String(rack.id), label: rack.label })),
          defaultOptionIds: [],
        });
      }
      if (showGroupFilter) {
        items.push({
          type: "dropdown",
          title: "Group",
          value: "group",
          options: availableGroups.map((g) => ({ id: String(g.id), label: g.label })),
          defaultOptionIds: [],
        });
      }
      if (showSiteFilter) {
        items.push({
          type: "dropdown",
          title: "Site",
          value: "site",
          options: [
            ...availableSites.map((site) => ({ id: site.id.toString(), label: site.name })),
            { id: UNASSIGNED_SITE_FILTER_ID, label: "Unassigned" },
          ],
          defaultOptionIds: [],
        });
      }
      return items;
    }, [
      showTypeFilter,
      showRackFilter,
      showGroupFilter,
      showSiteFilter,
      availableModels,
      availableRacks,
      availableGroups,
      availableSites,
    ]);

    const handleServerFilter = useCallback(
      async (activeFilters: ActiveFilters) => {
        const minerFilter = create(MinerListFilterSchema, {
          errorComponentTypes: [],
          siteIds: scopeSiteIds,
          includeUnassigned: scopeIncludeUnassigned,
        });

        const typeFilters = activeFilters.dropdownFilters.type;
        if (fixedModels && fixedModels.length > 0) {
          minerFilter.models.push(...fixedModels);
        } else if (typeFilters && typeFilters.length > 0) {
          minerFilter.models.push(...typeFilters);
        }

        if (showRackFilter) {
          const rackFilters = activeFilters.dropdownFilters.rack;
          if (rackFilters && rackFilters.length > 0) {
            minerFilter.rackIds.push(...rackFilters.map((id) => BigInt(id)));
          }
        }

        if (showGroupFilter) {
          const groupFilters = activeFilters.dropdownFilters.group;
          if (groupFilters && groupFilters.length > 0) {
            minerFilter.groupIds.push(...groupFilters.map((id) => BigInt(id)));
          }
        }

        if (showSiteFilter) {
          const siteFilters = activeFilters.dropdownFilters.site;
          if (siteFilters && siteFilters.length > 0) {
            minerFilter.siteIds.push(
              ...siteFilters.filter((id) => id !== UNASSIGNED_SITE_FILTER_ID).map((id) => BigInt(id)),
            );
            minerFilter.includeUnassigned = siteFilters.includes(UNASSIGNED_SITE_FILTER_ID);
          }
        }

        setFilter(minerFilter);
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [fixedModels, showRackFilter, showGroupFilter, showSiteFilter, scopeSiteIds, scopeIncludeUnassigned],
    );

    const showSpinner = (isLoading || isMembersLoading) && currentPageItems.length === 0;

    if (showSpinner) {
      return (
        <div className="flex justify-center py-20">
          <ProgressCircular indeterminate />
        </div>
      );
    }

    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto pb-2">
          <List<DeviceListItem, string, ModalColumn>
            activeCols={activeCols}
            colTitles={modalColTitles}
            colConfig={modalColConfig}
            filters={filters}
            onServerFilter={handleServerFilter}
            items={currentPageItems}
            itemKey="deviceIdentifier"
            noDataElement={noDataElement}
            itemSelectable
            selectionType={singleSelect ? "radio" : "checkbox"}
            sortableColumns={ALL_SORTABLE_COLUMNS}
            currentSort={currentSort}
            onSort={handleSort}
            customSelectedItems={displayedSelectedItems}
            customSetSelectedItems={handleSetSelectedItems}
            preserveOffPageSelection
            isRowDisabled={isRowDisabled}
            total={displayedTotalMiners}
            hideTotal
            itemName={{ singular: "miner", plural: "miners" }}
            containerClassName="min-h-0"
            overflowContainer
            stickyBgColor="bg-surface-elevated-base"
            footerContent={
              !isLoading && displayedTotalMiners !== undefined && displayedTotalMiners > 0 ? (
                <div className="flex flex-col items-center gap-4 py-6">
                  <span className="text-300 text-text-primary">
                    {visibleTotal === undefined
                      ? `Showing ${currentPage * PAGE_SIZE + 1}-${currentPage * PAGE_SIZE + currentPageItems.length} of ${displayedTotalMiners} miners`
                      : `${displayedTotalMiners} available ${displayedTotalMiners === 1 ? "miner" : "miners"}`}
                  </span>
                  <div className="flex gap-3">
                    <Button
                      variant={variants.secondary}
                      size={sizes.compact}
                      ariaLabel="Previous page"
                      prefixIcon={<ChevronDown className="rotate-90" />}
                      onClick={handlePrevPage}
                      disabled={!hasPreviousPage}
                    />
                    <Button
                      variant={variants.secondary}
                      size={sizes.compact}
                      ariaLabel="Next page"
                      prefixIcon={<ChevronDown className="rotate-270" />}
                      onClick={handleNextPage}
                      disabled={!hasMore}
                    />
                  </div>
                </div>
              ) : null
            }
          />
        </div>
        {shouldShowSelectionFooter ? (
          <div className="shrink-0">
            <ModalSelectAllFooter
              label={
                allSelected && canSelectAll
                  ? `All ${totalMiners} miners selected`
                  : `${selectedItems.length} miners selected`
              }
              onSelectAll={
                canSelectAll
                  ? () => {
                      setAllSelected(true);
                      const selectableItems = isRowDisabled
                        ? currentPageItems.filter((d) => !isRowDisabled(d))
                        : currentPageItems;
                      setSelectedItems(selectableItems.map((d) => d.deviceIdentifier));
                    }
                  : undefined
              }
              onSelectNone={
                allSelected || selectedItems.length > 0
                  ? () => {
                      setAllSelected(false);
                      setSelectedItems([]);
                    }
                  : undefined
              }
            />
          </div>
        ) : null}
      </div>
    );
  },
);

MinerSelectionList.displayName = "MinerSelectionList";

export default MinerSelectionList;
