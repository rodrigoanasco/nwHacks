"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";
import { toast } from "sonner";

type QuestionListItem = {
  name: string;
  difficulty: "easy" | "medium" | "hard" | string;
};

type ProgressQuestion = {
  name: string;
  attempts: number;
  passed: boolean;
};

type ProblemRow = {
  name: string;
  difficulty: string;
  completed: "completed" | "in_progress" | "incomplete";
  attemps: number;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function DashboardClient() {
  const [rows, setRows] = useState<ProblemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [qRes, pRes] = await Promise.all([
          fetch("/api/question/all", { method: "GET" }),
          fetch("/api/progress", { method: "GET" }),
        ]);

        if (!qRes.ok) throw new Error(`question/all failed: ${qRes.status}`);
        if (!pRes.ok) throw new Error(`progress failed: ${pRes.status}`);

        const qJson: { questionBank: QuestionListItem[] } = await qRes.json();
        const pJson: { userId: string; questions: ProgressQuestion[] } =
          await pRes.json();

        // Build rows from responses (do not mutate state directly)
        const newRows: ProblemRow[] = qJson.questionBank.map((q) => {
          const prog = pJson.questions.find((pq) => pq.name === q.name);
          const attempts = prog ? prog.attempts : 0;
          let completed: ProblemRow["completed"] =
            prog && prog.passed ? "completed" : "incomplete";
          if (prog && !prog.passed && prog.attempts > 0)
            completed = "in_progress";

          return {
            name: q.name,
            difficulty: q.difficulty,
            completed,
            attemps: attempts,
          };
        });

        setRows(newRows);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load dashboard data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const buttonCallback = async (name: string) => {
    const apiRequestBody = {
      name: name,
      userId: "default",
    };
    await fetch("/api/question", {
      method: "POST", // Specify the method
      headers: {
        "Content-Type": "application/json", // Indicate the content type
      },
      body: JSON.stringify(apiRequestBody),
    });

    toast.success("3D model has been loaded, open up blender please.");
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="pt-20 px-6">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-3xl font-bold mb-8 text-foreground">Problems</h1>

          {loading && <p>Loading...</p>}
          {error && <p className="text-red-600">{error}</p>}

          {!loading && !error && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model Name</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {rows.map((problem, index) => (
                  <TableRow key={`${problem.name}-${index}`}>
                    <TableCell className="font-medium">
                      <Link href={`/${problem.name}`}>{problem.name}</Link>
                    </TableCell>

                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                          problem.difficulty === "easy"
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : problem.difficulty === "medium"
                              ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                              : problem.difficulty === "hard"
                                ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                        }`}
                      >
                        {problem.difficulty.charAt(0).toUpperCase() +
                          problem.difficulty.slice(1)}
                      </span>
                    </TableCell>

                    <TableCell>{problem.attemps}</TableCell>

                    <TableCell>
                      {problem.completed === "completed" && (
                        <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          ✓ Completed
                        </span>
                      )}
                      {problem.completed === "incomplete" && (
                        <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                          Incomplete
                        </span>
                      )}
                      {problem.completed === "in_progress" && (
                        <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-gray-100 text-yellow-800 dark:bg-yellow-700 dark:text-gray-200">
                          In Progress
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </main>
    </div>
  );
}
