import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { AlertTriangle } from 'lucide-react'

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Deletion',
  itemName = '',
  itemType = 'item',
  warningMessage = '',
  loading = false,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-md">
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle size={22} className="text-red-500 shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">
            <p className="font-semibold">
              Are you sure you want to delete {itemType}{' '}
              <span className="font-mono bg-red-100 px-1 py-0.5 rounded text-red-800">
                &ldquo;{itemName}&rdquo;
              </span>
              ?
            </p>
            {warningMessage ? (
              <p className="mt-1.5 text-xs text-red-600 leading-relaxed">{warningMessage}</p>
            ) : (
              <p className="mt-1 text-xs text-red-600">
                This action cannot be undone.
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={onConfirm}
            loading={loading}
          >
            Delete {itemType}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
