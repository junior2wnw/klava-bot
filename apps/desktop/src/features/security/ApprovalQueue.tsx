import type { ApprovalRequest } from "@klava/contracts";
import { Button, PanelCard, Stack, StatusPill } from "@klava/ui";

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
  if (!approvals.length) {
    return null;
  }

  return (
    <PanelCard title="Approvals" subtitle="Guarded actions stay explicit and local.">
      <Stack gap={10}>
        {approvals
          .slice()
          .reverse()
          .map((approval) => (
            <div className="approval-item" key={approval.id}>
              <div className="approval-item__head">
                <strong>{approval.action}</strong>
                <StatusPill tone={approvalTone(approval.status)} value={approval.status} />
              </div>
              <code>{approval.command}</code>
              <p>{approval.impact}</p>
              {approval.status === "pending" ? (
                <div className="approval-item__actions">
                  <Button variant="secondary" onClick={() => onReject(approval.id)} style={{ height: 34 }}>
                    Reject
                  </Button>
                  <Button onClick={() => onApprove(approval.id)} style={{ height: 34 }}>
                    Approve
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
      </Stack>
    </PanelCard>
  );
}
