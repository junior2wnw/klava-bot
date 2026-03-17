import type { ApprovalRequest } from "@klava/contracts";
import { Button, PanelCard, Stack, StatusPill } from "@klava/ui";
import { useAppI18n } from "../../i18n/AppI18n";

function approvalTone(status: ApprovalRequest["status"]) {
  return status === "approved" ? "success" : status === "rejected" ? "danger" : "warning";
}

export function ApprovalQueue({
  approvals,
  onApprove,
  onReject,
}: {
  approvals: ApprovalRequest[];
  onApprove: (approvalId: string) => void;
  onReject: (approvalId: string) => void;
}) {
  const { t } = useAppI18n();
  if (!approvals.length) {
    return null;
  }

  return (
    <PanelCard title={t("Approvals", "Подтверждения")} subtitle={t("Guarded actions stay explicit and local.", "Защищённые действия остаются явными и локальными.")}>
      <Stack gap={10}>
        {approvals
          .slice()
          .reverse()
          .map((approval) => (
            <div className="approval-item" key={approval.id}>
              <div className="approval-item__head">
                <strong>{approval.action}</strong>
                <StatusPill
                  tone={approvalTone(approval.status)}
                  value={
                    approval.status === "approved"
                      ? t("approved", "подтверждено")
                      : approval.status === "rejected"
                        ? t("rejected", "отклонено")
                        : t("pending", "ожидает")
                  }
                />
              </div>
              <code>{approval.command}</code>
              <p>{approval.impact}</p>
              {approval.status === "pending" ? (
                <div className="approval-item__actions">
                  <Button variant="secondary" onClick={() => onReject(approval.id)} style={{ height: 34 }}>
                    {t("Reject", "Отклонить")}
                  </Button>
                  <Button onClick={() => onApprove(approval.id)} style={{ height: 34 }}>
                    {t("Approve", "Подтвердить")}
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
      </Stack>
    </PanelCard>
  );
}
