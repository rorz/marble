import {
  MarbleAlert,
  MarbleBadge,
  MarbleButton,
  MarbleConfirmModal,
  type MarbleConfirmModalState,
  MarbleModal,
  MarbleModalClose,
  MarbleModalContent,
  MarbleModalDescription,
  MarbleModalFooter,
  MarbleModalHeader,
  MarbleModalTitle,
  MarbleSheet,
  MarbleSheetClose,
  MarbleSheetContent,
  MarbleSheetDescription,
  MarbleSheetFooter,
  MarbleSheetHeader,
  MarbleSheetTitle,
} from "@marble/ui";
import { useState } from "react";
import { DemoPanel, Section } from "./chrome";

const sheetSides = [
  "right",
  "left",
  "top",
  "bottom",
] as const;

const modalSizes = [
  "sm",
  "md",
  "lg",
] as const;

type SheetSide = (typeof sheetSides)[number];
type ModalSize = (typeof modalSizes)[number];

export const OverlaysSection = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSize, setModalSize] = useState<ModalSize>("md");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [sheetSide, setSheetSide] = useState<SheetSide>("right");
  const [confirmState, setConfirmState] =
    useState<MarbleConfirmModalState | null>(null);
  const [, setLastOverlayAction] = useState("Waiting for input");

  return (
    <>
      <Section
        description="Overlay coverage includes all modal sizes plus every sheet side, with both sheets and modals rendered as real top-layer portals instead of fighting local stacking contexts."
        id="overlays"
        title="Overlays"
      >
        <div className="space-y-4">
          <DemoPanel
            description="Every side is selectable from the harness, and the sheet now portals to the page root instead of pretending its host card is the viewport."
            title="Sheet"
          >
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {sheetSides.map((side) => (
                  <MarbleButton
                    key={side}
                    onClick={() => {
                      setSheetSide(side);
                      setIsSheetOpen(true);
                    }}
                    size="sm"
                    variant={sheetSide === side ? "orange" : "light"}
                  >
                    {side}
                  </MarbleButton>
                ))}
              </div>

              <div className="h-88 overflow-hidden rounded-xs border border-taupe-200 bg-white">
                <div className="flex h-full flex-col gap-3 bg-linear-to-br from-white via-taupe-50 to-taupe-100 p-4">
                  <MarbleBadge
                    caps
                    tone="info"
                  >
                    Underlay
                  </MarbleBadge>
                  <div className="space-y-2">
                    <h3 className="font-semibold text-lg text-taupe-900">
                      Underlying page
                    </h3>
                    <p className="max-w-sm text-sm text-taupe-600">
                      Opening a sheet now uses the document-level overlay layer,
                      so this card is just the page beneath it.
                    </p>
                  </div>
                </div>

                <MarbleSheet
                  onOpenChange={setIsSheetOpen}
                  open={isSheetOpen}
                >
                  <MarbleSheetContent
                    showCloseButton={false}
                    side={sheetSide}
                  >
                    <MarbleSheetHeader className="relative pr-14">
                      <MarbleSheetTitle>Shared sheet shell</MarbleSheetTitle>
                      <MarbleSheetDescription>
                        Side-specific motion now works for every exposed
                        variant.
                      </MarbleSheetDescription>
                      <MarbleSheetClose className="absolute top-3 right-3" />
                    </MarbleSheetHeader>

                    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
                      <MarbleAlert
                        size="sm"
                        tone="neutral"
                      >
                        The sheet is no longer clipped by the demo card.
                      </MarbleAlert>
                      <p className="text-sm text-taupe-600">
                        Current side:{" "}
                        <span className="font-medium">{sheetSide}</span>
                      </p>
                    </div>

                    <MarbleSheetFooter>
                      <MarbleSheetClose variant="button">
                        Dismiss
                      </MarbleSheetClose>
                      <MarbleButton variant="orange">Apply</MarbleButton>
                    </MarbleSheetFooter>
                  </MarbleSheetContent>
                </MarbleSheet>
              </div>
            </div>
          </DemoPanel>

          <DemoPanel
            description="Modal sizes use a shared trigger harness, and the dialog description is now surfaced in the catalog. MarbleModalClose ships an icon-only close affordance for header chrome."
            title="Modal"
          >
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {modalSizes.map((size) => (
                  <MarbleButton
                    key={size}
                    onClick={() => {
                      setModalSize(size);
                      setIsModalOpen(true);
                    }}
                    size="sm"
                    variant={modalSize === size ? "dark" : "light"}
                  >
                    Open {size}
                  </MarbleButton>
                ))}
              </div>

              <div className="rounded-xs border border-taupe-200 bg-white px-3 py-3">
                <div className="font-medium text-eyebrow-lg text-taupe-500">
                  Current modal size
                </div>
                <div className="mt-1 font-medium text-sm text-taupe-900">
                  {modalSize.toUpperCase()}
                </div>
              </div>

              <MarbleAlert tone="neutral">
                Modals now render through a portal so they clear page-level
                stacking contexts like the internal catalog cards.
              </MarbleAlert>
            </div>
          </DemoPanel>

          <DemoPanel
            description="Confirm modal promotes the destructive-action pattern. Use it in place of window.confirm anywhere a deletion or revocation needs review."
            title="Confirm modal"
          >
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <MarbleButton
                  onClick={() =>
                    setConfirmState({
                      confirmLabel: "Delete",
                      message:
                        'Delete "Audience Enrichment"? All rows and cells will be permanently removed.',
                      onConfirm: () =>
                        setLastOverlayAction("Confirm modal: Delete confirmed"),
                      title: "Delete project",
                    })
                  }
                  size="sm"
                  variant="red"
                >
                  Open destructive confirm
                </MarbleButton>
                <MarbleButton
                  onClick={() =>
                    setConfirmState({
                      cancelLabel: "Keep editing",
                      confirmLabel: "Publish v13",
                      confirmVariant: "orange",
                      message:
                        "Publishing locks the draft. Existing columns stay pinned to v12.",
                      onConfirm: () =>
                        setLastOverlayAction(
                          "Confirm modal: Publish confirmed",
                        ),
                      title: "Publish program",
                    })
                  }
                  size="sm"
                  variant="orange"
                >
                  Open promote confirm
                </MarbleButton>
              </div>
            </div>
          </DemoPanel>
        </div>
      </Section>

      <MarbleConfirmModal
        onClose={() => setConfirmState(null)}
        state={confirmState}
      />

      {isModalOpen ? (
        <MarbleModal
          ariaLabel="UI catalog modal demo"
          onClose={() => setIsModalOpen(false)}
          size={modalSize}
        >
          <MarbleModalHeader>
            <div className="min-w-0 flex-1 space-y-1">
              <MarbleModalTitle>Shared modal shell</MarbleModalTitle>
              <MarbleModalDescription>
                Portal-backed overlay with a size-aware panel and shared
                dismissal behavior.
              </MarbleModalDescription>
            </div>
            <MarbleModalClose onClick={() => setIsModalOpen(false)} />
          </MarbleModalHeader>
          <MarbleModalContent className="space-y-3">
            <p className="text-sm text-taupe-600">
              This demo intentionally sits outside the section cards so the
              overlay behavior matches real usage.
            </p>
            <MarbleAlert
              size="sm"
              tone="warning"
            >
              Escape and backdrop dismissal are handled in the shared component.
            </MarbleAlert>
          </MarbleModalContent>
          <MarbleModalFooter>
            <MarbleButton
              onClick={() => setIsModalOpen(false)}
              size="sm"
            >
              Close
            </MarbleButton>
            <MarbleButton
              size="sm"
              variant="orange"
            >
              Confirm
            </MarbleButton>
          </MarbleModalFooter>
        </MarbleModal>
      ) : null}
    </>
  );
};
