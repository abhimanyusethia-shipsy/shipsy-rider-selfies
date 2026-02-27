"use client";

interface AIReasoningPanelProps {
  reasoning: string[];
  status?: "approved" | "rejected" | "pending";
}

export default function AIReasoningPanel({ reasoning, status }: AIReasoningPanelProps) {
  const borderColor =
    status === "approved"
      ? "border-green-200 bg-green-50"
      : status === "rejected"
        ? "border-red-200 bg-red-50"
        : "border-gray-200 bg-gray-50";

  return (
    <div className={`border rounded-lg p-3 ${borderColor}`}>
      <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
        AI Analysis
      </div>
      <ul className="space-y-1">
        {reasoning.map((point, i) => (
          <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
            <span className="text-gray-400 mt-0.5">•</span>
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
