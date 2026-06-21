import type { DiffResult, DiffHunk, DiffLine } from "@/types";

// Basit line-based diff
export function createDiff(
  filePath: string,
  originalContent: string,
  newContent: string,
  language: string
): DiffResult {
  const hunks = computeLineDiff(originalContent, newContent);
  return {
    filePath,
    originalContent,
    newContent,
    hunks,
    language,
    applied: false,
  };
}

function computeLineDiff(original: string, modified: string): DiffHunk[] {
  const oldLines = original.split("\n");
  const newLines = modified.split("\n");

  // LCS-based diff
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array(m + 1)
    .fill(0)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack
  const lines: DiffLine[] = [];
  let i = m,
    j = n;
  while (i > 0 && j > 0) {
    if (oldLines[i - 1] === newLines[j - 1]) {
      lines.unshift({
        type: "context",
        content: oldLines[i - 1],
        oldNumber: i,
        newNumber: j,
      });
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      lines.unshift({
        type: "remove",
        content: oldLines[i - 1],
        oldNumber: i,
      });
      i--;
    } else {
      lines.unshift({
        type: "add",
        content: newLines[j - 1],
        newNumber: j,
      });
      j--;
    }
  }
  while (i > 0) {
    lines.unshift({
      type: "remove",
      content: oldLines[i - 1],
      oldNumber: i,
    });
    i--;
  }
  while (j > 0) {
    lines.unshift({
      type: "add",
      content: newLines[j - 1],
      newNumber: j,
    });
    j--;
  }

  // Group into hunks (3-line context)
  return groupIntoHunks(lines);
}

function groupIntoHunks(lines: DiffLine[]): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  const CONTEXT = 3;
  let currentHunk: DiffLine[] = [];
  let currentStart: { old: number; new: number } | null = null;
  let lastChange = -1;

  lines.forEach((line, idx) => {
    if (line.type !== "context") {
      if (currentStart === null) {
        // Start new hunk - include context before
        const startIdx = Math.max(0, idx - CONTEXT);
        currentStart = {
          old: lines[startIdx].oldNumber ?? 1,
          new: lines[startIdx].newNumber ?? 1,
        };
        for (let k = startIdx; k < idx; k++) {
          currentHunk.push(lines[k]);
        }
      }
      lastChange = idx;
      currentHunk.push(line);
    } else if (currentStart !== null) {
      // Within hunk, add context line
      currentHunk.push(line);
      // If too much context since last change, close hunk
      if (idx - lastChange > CONTEXT) {
        // Trim trailing context
        currentHunk = currentHunk.slice(
          0,
          currentHunk.length - (idx - lastChange - CONTEXT)
        );
        hunks.push(buildHunk(currentHunk, currentStart));
        currentHunk = [];
        currentStart = null;
      }
    }
  });

  if (currentStart !== null && currentHunk.length > 0) {
    hunks.push(buildHunk(currentHunk, currentStart));
  }

  return hunks;
}

function buildHunk(
  lines: DiffLine[],
  start: { old: number; new: number }
): DiffHunk {
  const oldLines = lines.filter((l) => l.type !== "add").length;
  const newLines = lines.filter((l) => l.type !== "remove").length;
  return {
    oldStart: start.old,
    oldLines,
    newStart: start.new,
    newLines,
    lines,
  };
}

// AI cevabından kod bloklarını çıkar
export function extractCodeBlocks(
  content: string
): Array<{ language: string; code: string; filename?: string }> {
  const blocks: Array<{ language: string; code: string; filename?: string }> = [];
  const regex = /```(\w+)?(?::([^\n]+))?\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    blocks.push({
      language: match[1] || "plaintext",
      filename: match[2]?.trim(),
      code: match[3],
    });
  }
  return blocks;
}

// Diff formatına çevir (patch benzeri)
export function diffToPatch(diff: DiffResult): string {
  let patch = `--- a/${diff.filePath}\n+++ b/${diff.filePath}\n`;
  diff.hunks.forEach((hunk) => {
    patch += `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@\n`;
    hunk.lines.forEach((line) => {
      const prefix = line.type === "add" ? "+" : line.type === "remove" ? "-" : " ";
      patch += prefix + line.content + "\n";
    });
  });
  return patch;
}

// İki string arasındaki benzerlik (0-1)
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1;
  const dist = levenshtein(shorter, longer);
  return (longer.length - dist) / longer.length;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array(m + 1)
    .fill(0)
    .map(() => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}
