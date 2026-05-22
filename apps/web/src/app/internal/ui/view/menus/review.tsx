import { MarbleReviewNavigator } from "@marble/ui";
import type { Dispatch, SetStateAction } from "react";

export const ReviewNavigatorDemo = ({
  handleMenuSelect,
  reviewNavigatorIndex,
  setLastInteraction,
  setReviewNavigatorIndex,
}: Readonly<{
  handleMenuSelect: (label: string) => void;
  reviewNavigatorIndex: number;
  setLastInteraction: (label: string) => void;
  setReviewNavigatorIndex: Dispatch<SetStateAction<number>>;
}>) => {
  return (
    <div className="rounded-xs border border-taupe-200 bg-white p-3">
      <div className="mb-3 space-y-1">
        <div className="font-medium text-sm text-taupe-950">
          Review navigator
        </div>
        <div className="text-sm text-taupe-600">
          Compact review tray for stepping through grouped changes.
        </div>
      </div>

      <MarbleReviewNavigator
        currentIndex={reviewNavigatorIndex}
        detailItems={[
          {
            label: "12 waves",
            targetKeys: [
              "table:demo-review",
            ],
          },
          {
            diffs: [
              {
                count: 24,
                targetKeys: [
                  "cell:row-a:col-subject",
                  "cell:row-b:col-subject",
                ],
                tone: "update",
              },
            ],
            label: "24 cells",
            targetKeys: [
              "cell:row-a:col-subject",
              "cell:row-b:col-subject",
              "cell:row-c:col-subject",
            ],
          },
          {
            diffs: [
              {
                count: 3,
                targetKeys: [
                  "column:col-chaos",
                ],
                tone: "update",
              },
              {
                count: 1,
                targetKeys: [
                  "column:col-chaos",
                ],
                tone: "delete",
              },
            ],
            label: "4 column dependencies",
            targetKeys: [
              "column:col-chaos",
              "column:col-vibe",
            ],
          },
        ]}
        onClose={() => handleMenuSelect("Review navigator: Close")}
        onNext={() => setReviewNavigatorIndex((current) => (current + 1) % 6)}
        onPreviewTargetsEnd={() =>
          setLastInteraction("Review navigator: Preview cleared")
        }
        onPreviewTargetsStart={(targetKeys) =>
          setLastInteraction(
            `Review navigator: Preview ${targetKeys.length} target${targetKeys.length === 1 ? "" : "s"}`,
          )
        }
        onPrevious={() =>
          setReviewNavigatorIndex((current) => (current - 1 + 6) % 6)
        }
        onSelectIndex={setReviewNavigatorIndex}
        summary="Snack Vibe Matrix"
        totalCount={6}
      />
    </div>
  );
};
