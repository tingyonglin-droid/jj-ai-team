import { ApprovalStore } from "./approval-store";
import { DrizzleApprovalEventRepository } from "./d1-approval-repository";

export function createApprovalStore() {
  return new ApprovalStore(new DrizzleApprovalEventRepository());
}
