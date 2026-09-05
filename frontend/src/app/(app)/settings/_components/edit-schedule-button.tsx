"use client";

import { Pencil } from "lucide-react";
import type { WorkingScheduleDto } from "@peoplepay360/shared";

import { RecordDialog } from "@/components/form";
import { IconButton } from "@/components/ui";

import { saveSchedule } from "../actions";
import { scheduleFields } from "../fields";
import { ScheduleLinesField } from "./schedule-lines-field";

/**
 * Editing a schedule means editing its week, and that control rides in the
 * dialog's extras slot, which the row menu cannot carry. So the edit gets its
 * own trigger.
 *
 * The trigger is built here rather than on the page because the dialog slots
 * it onto the button Radix renders, and an element a server component creates
 * cannot be slotted onto anything: it reaches the client as a reference, not
 * as the single element the slot expects.
 */
export function EditScheduleButton({
  schedule,
}: {
  schedule: WorkingScheduleDto;
}) {
  return (
    <RecordDialog
      title="Edit schedule"
      description="Saving replaces the whole week, so the days below are the schedule as it will be."
      fields={scheduleFields()}
      action={saveSchedule}
      record={{ ...schedule }}
      submitLabel="Save changes"
      extras={<ScheduleLinesField defaultLines={schedule.lines} />}
      trigger={
        <IconButton
          icon={<Pencil />}
          label={`Edit ${schedule.name}`}
          size="sm"
        />
      }
    />
  );
}
