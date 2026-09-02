# Implementation Plan - Practice Mode Fixes

This plan addresses two issues in the practice mode:
1.  **State Persistence on Genre Change**: The practice result and input remain when switching back to the genre selection screen and starting a new session.
2.  **Vietnamese Orthography Normalization**: Handling the differences between "old style" and "new style" tone mark placement in Vietnamese to ensure correct answer matching regardless of input method.

## User Review Required

> [!NOTE]
> For Vietnamese orthography, I will implement a normalization function that converts "old style" tone placement (e.g., `òa`, `òe`, `úy`) to "new style" (e.g., `oà`, `oè`, `uý`) before comparison. This covers the most common differences caused by different keyboard engines.

## Proposed Changes

### Practice Mode Component

#### [MODIFY] [PracticeMode.jsx](file:///C:/Users/yukis/StudioProjects/hocviet/src/components/PracticeMode.jsx)
- Update the "ジャンル変更" (Change Genre) button handler to reset `result`, `input`, and `attemptCount` states. This ensures that returning to the genre selection screen clears the previous practice state.

### Database / Logic Utilities

#### [MODIFY] [db.js](file:///C:/Users/yukis/StudioProjects/hocviet/src/db.js)
- Add a `normalizeVietnameseOrthography` function to handle the conversion between old and new orthography styles.
- Update `normalizeText` to include this orthography normalization step.
- This will ensure `checkAnswer` (which uses `normalizeText`) is resilient to these orthography differences.

## Verification Plan

### Automated Tests
- I will verify the logic by checking if `checkAnswer("hòa", "hoà")` and `checkAnswer("hoà", "hòa")` both return `true`.

### Manual Verification
1.  **Genre Change Reset**:
    - Start a practice session.
    - Enter an answer (correct or incorrect).
    - Click "ジャンル変更".
    - Select a genre and start again.
    - Verify the input field is empty and the result message is gone.
2.  **Orthography Absorption**:
    - Find a word with `oa`, `oe`, or `uy` (e.g., `hòa`).
    - Test by entering the answer in both old style (`hòa`) and new style (`hoà`) if possible with the keyboard.
    - Verify both are accepted as correct.
