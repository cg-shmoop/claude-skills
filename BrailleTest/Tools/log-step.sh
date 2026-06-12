#!/bin/bash
# log-step.sh — Append a braille session step to a JSONL log file.
# Uses jq for proper JSON escaping. All args passed as environment variables.
#
# Required env vars: LOGFILE, STEP, DISPLAY, FULLLINE, MODE, SPEECH,
#   CMD_JSON, CMD_DESC, KEYSTROKE, REASONING, SUCCESS, CONFUSED
# Optional: CONFUSION_DESC, GOAL_COMPLETE

jq -n -c \
  --argjson step "${STEP:-0}" \
  --arg display "$DISPLAY" \
  --arg fullLine "$FULLLINE" \
  --arg mode "${MODE:-browse}" \
  --arg speech "$SPEECH" \
  --argjson command "${CMD_JSON:-{}}" \
  --arg commandDesc "$CMD_DESC" \
  --arg keystroke "$KEYSTROKE" \
  --arg reasoning "$REASONING" \
  --argjson success "${SUCCESS:-true}" \
  --argjson confused "${CONFUSED:-false}" \
  --arg confusionDesc "${CONFUSION_DESC:-}" \
  --argjson goalComplete "${GOAL_COMPLETE:-false}" \
  '{step:$step,display:$display,fullLine:$fullLine,mode:$mode,speech:$speech,command:$command,commandDesc:$commandDesc,keystroke:$keystroke,reasoning:$reasoning,success:$success,confused:$confused,confusionDesc:$confusionDesc,goalComplete:$goalComplete}' \
  >> "$LOGFILE"
