"use client";

import {
  MarbleButton,
  MarbleCopyField,
  MarbleModal,
  MarbleModalClose,
  MarbleModalContent,
  MarbleModalDescription,
  MarbleModalFooter,
  MarbleModalHeader,
  MarbleModalTitle,
} from "@marble/ui";

export const NewKeyModal = ({
  onClose,
  profileName,
  token,
}: {
  onClose: () => void;
  profileName: string;
  token: string;
}) => {
  return (
    <MarbleModal
      ariaLabel={`New key for ${profileName}`}
      onClose={onClose}
      size="md"
    >
      <MarbleModalHeader>
        <MarbleModalTitle>New key for {profileName}</MarbleModalTitle>
        <MarbleModalClose onClick={onClose} />
      </MarbleModalHeader>
      <MarbleModalContent className="space-y-3">
        <MarbleModalDescription>
          This is the only time the full token is shown. Copy it now and store
          it somewhere secret.
        </MarbleModalDescription>
        <MarbleCopyField
          label="Token"
          value={token}
        />
      </MarbleModalContent>
      <MarbleModalFooter>
        <MarbleButton
          onClick={onClose}
          type="button"
          variant="dark"
        >
          Done
        </MarbleButton>
      </MarbleModalFooter>
    </MarbleModal>
  );
};
