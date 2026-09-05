"use server";

import { callAction, type FormState } from "@/lib/mutate";

/**
 * A payslip is produced by a pay run, never typed in, so there is nothing here
 * to create, edit or delete. Recompute is the only write the API exposes: it
 * throws away the stored lines and builds them again from the salary rules and
 * contract as they stand now.
 */
export async function recomputePayslip(id: string): Promise<FormState> {
  return callAction({
    path: `/payslips/${id}/recompute`,
    message: "Payslip recomputed.",
  });
}
