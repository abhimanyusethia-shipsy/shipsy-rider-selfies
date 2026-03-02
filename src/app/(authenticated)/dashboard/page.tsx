"use client";

import { useState, useEffect, useCallback } from "react";
import StatusBadge from "@/components/StatusBadge";
import ImageViewer from "@/components/ImageViewer";

interface Stats {
  total: number;
  approved: number;
  rejected: number;
  uniqueUsers: number;
  approvedPct: number;
  rejectedPct: number;
}

interface Selfie {
  id: number;
  selfieUrl: string;
  profileUrl: string | null;
  aiStatus: "approved" | "rejected" | "pending";
  aiReasoning: string[];
  aiFaceValid: boolean;
  aiRealPerson: boolean;
  aiFaceMatch: boolean;
  uploadedAt: string;
  workerName: string;
  username: string;
}

interface DashboardData {
  selfies: Selfie[];
  total: number;
  page: number;
  totalPages: number;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats");
      const json = await res.json();
      setStats(json);
    } catch {
      console.error("Failed to fetch stats");
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "15",
      });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/selfies?${params}`);
      const json = await res.json();
      setData(json);
    } catch {
      console.error("Failed to fetch dashboard data");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search, dateFrom, dateTo]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchData();
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "Z");
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-4">

      {/* Metrics Panel */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white rounded-xl shadow-sm px-4 md:px-5 py-3 md:py-4 flex items-center gap-3 md:gap-4">
          <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5h18M3 12h18M3 16.5h18" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide truncate">Selfies Processed</p>
            <p className="text-xl md:text-2xl font-bold text-gray-800 leading-tight">{stats?.total ?? "—"}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm px-4 md:px-5 py-3 md:py-4 flex items-center gap-3 md:gap-4">
          <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Approved</p>
            <p className="text-xl md:text-2xl font-bold text-green-600 leading-tight">
              {stats ? `${stats.approvedPct}%` : "—"}
            </p>
            <p className="text-xs text-gray-400">{stats?.approved ?? 0} selfies</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm px-4 md:px-5 py-3 md:py-4 flex items-center gap-3 md:gap-4">
          <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Rejected</p>
            <p className="text-xl md:text-2xl font-bold text-red-500 leading-tight">
              {stats ? `${stats.rejectedPct}%` : "—"}
            </p>
            <p className="text-xs text-gray-400">{stats?.rejected ?? 0} selfies</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm px-4 md:px-5 py-3 md:py-4 flex items-center gap-3 md:gap-4">
          <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Users</p>
            <p className="text-xl md:text-2xl font-bold text-gray-800 leading-tight">{stats?.uniqueUsers ?? "—"}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-3 md:p-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 flex-wrap">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search worker name..."
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none w-full sm:w-52"
          />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          >
            <option value="all">All Status</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2">
            <span className="text-xs text-gray-400 font-medium whitespace-nowrap">From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="text-sm outline-none bg-transparent min-w-0 flex-1"
            />
            <span className="text-xs text-gray-400 font-medium whitespace-nowrap">To</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="text-sm outline-none bg-transparent min-w-0 flex-1"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 sm:flex-none px-6 py-2 rounded-lg text-white text-sm font-medium cursor-pointer"
              style={{ backgroundColor: "var(--color-navy)" }}
            >
              Filter
            </button>
            {(dateFrom || dateTo || search || statusFilter !== "all") && (
              <button
                type="button"
                onClick={() => { setSearch(""); setStatusFilter("all"); setDateFrom(""); setDateTo(""); setPage(1); }}
                className="flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium text-gray-500 border border-gray-300 hover:bg-gray-50 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
          <div className="sm:ml-auto text-sm text-gray-500 text-center sm:text-right">
            {data && `${data.total} records`}
          </div>
        </form>
      </div>

      {/* Table - desktop / Cards - mobile */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-500">
            Loading...
          </div>
        ) : !data || data.selfies.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-500 px-4 text-center">
            No selfies found. Riders can upload selfies from the Capture page.
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: "var(--color-navy)" }}>
                    <th className="text-left text-white text-xs font-semibold px-4 py-3">
                      S.No
                    </th>
                    <th className="text-left text-white text-xs font-semibold px-4 py-3">
                      Worker Name
                    </th>
                    <th className="text-left text-white text-xs font-semibold px-4 py-3">
                      Selfie
                    </th>
                    <th className="text-left text-white text-xs font-semibold px-4 py-3">
                      Profile
                    </th>
                    <th className="text-left text-white text-xs font-semibold px-4 py-3">
                      Date/Time
                    </th>
                    <th className="text-left text-white text-xs font-semibold px-4 py-3">
                      Status
                    </th>
                    <th className="text-left text-white text-xs font-semibold px-4 py-3">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.selfies.map((selfie, index) => (
                    <>
                      <tr
                        key={selfie.id}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {(data.page - 1) * 15 + index + 1}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-blue-600">
                          {selfie.workerName}
                        </td>
                        <td className="px-4 py-3">
                          <img
                            src={selfie.selfieUrl}
                            alt="Selfie"
                            className="w-10 h-10 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => setViewerImage(selfie.selfieUrl)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          {selfie.profileUrl ? (
                            <img
                              src={selfie.profileUrl}
                              alt="Profile"
                              className="w-10 h-10 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => setViewerImage(selfie.profileUrl!)}
                            />
                          ) : (
                            <span className="text-xs text-gray-400">N/A</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {formatDate(selfie.uploadedAt)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={selfie.aiStatus} />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() =>
                              setExpandedRow(
                                expandedRow === selfie.id ? null : selfie.id
                              )
                            }
                            className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer"
                          >
                            {expandedRow === selfie.id ? "Hide" : "View"}
                          </button>
                        </td>
                      </tr>
                      {expandedRow === selfie.id && (() => {
                        const passed = [selfie.aiFaceValid, selfie.aiRealPerson, selfie.aiFaceMatch].filter(Boolean).length;
                        const score = Math.round((passed / 3) * 100);
                        const scoreBarColor =
                          score === 100 ? "bg-green-500" :
                          score >= 67   ? "bg-amber-400" :
                          score >= 33   ? "bg-orange-400" : "bg-red-500";
                        const criteria = [
                          { pass: selfie.aiFaceValid,  label: "Valid Face Detected", reason: selfie.aiReasoning?.[0] },
                          { pass: selfie.aiRealPerson, label: "Real Person",         reason: selfie.aiReasoning?.[1] },
                          { pass: selfie.aiFaceMatch,  label: "Matches Profile",     reason: selfie.aiReasoning?.[2] },
                        ];
                        return (
                          <tr key={`${selfie.id}-details`} className="bg-gray-50">
                            <td colSpan={7} className="px-6 py-5 border-b border-gray-100">
                              <div className="flex items-start gap-8">
                                {/* Images */}
                                <div className="flex gap-4 flex-shrink-0">
                                  <div className="flex flex-col items-center gap-1.5">
                                    <img
                                      src={selfie.selfieUrl}
                                      alt="Selfie"
                                      className="w-24 h-24 object-cover rounded-xl cursor-pointer hover:opacity-80 transition-opacity shadow-sm"
                                      onClick={() => setViewerImage(selfie.selfieUrl)}
                                    />
                                    <span className="text-xs text-gray-400">Selfie</span>
                                  </div>
                                  {selfie.profileUrl && (
                                    <div className="flex flex-col items-center gap-1.5">
                                      <img
                                        src={selfie.profileUrl}
                                        alt="Profile"
                                        className="w-24 h-24 object-cover rounded-xl cursor-pointer hover:opacity-80 transition-opacity shadow-sm"
                                        onClick={() => setViewerImage(selfie.profileUrl!)}
                                      />
                                      <span className="text-xs text-gray-400">Profile</span>
                                    </div>
                                  )}
                                </div>

                                {/* AI Verification Report */}
                                <div className={`flex-1 border rounded-xl px-5 py-4 bg-white ${
                                  selfie.aiStatus === "approved" ? "border-green-200" : "border-red-200"
                                }`}>
                                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                                    AI Verification Report
                                  </p>

                                  {/* Match Score */}
                                  <div className="mb-4">
                                    <div className="flex justify-between items-center mb-1.5">
                                      <span className="text-xs text-gray-500">Match Score</span>
                                      <span className={`text-xs font-bold ${
                                        score === 100 ? "text-green-600" :
                                        score >= 67   ? "text-amber-500" :
                                        score >= 33   ? "text-orange-500" : "text-red-500"
                                      }`}>{score}%</span>
                                    </div>
                                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${scoreBarColor} transition-all duration-500`}
                                        style={{ width: `${score}%` }}
                                      />
                                    </div>
                                  </div>

                                  {/* Criteria */}
                                  <div className="space-y-3">
                                    {criteria.map(({ pass, label, reason }) => (
                                      <div key={label} className="flex items-start gap-2.5">
                                        {pass ? (
                                          <svg className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                                        ) : (
                                          <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                        )}
                                        <div>
                                          <p className="text-sm font-medium text-gray-800">{label}</p>
                                          {reason && <p className="text-xs text-gray-500 mt-0.5">{reason}</p>}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })()}
                    </>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {data.selfies.map((selfie, index) => {
                const isExpanded = expandedRow === selfie.id;
                const passed = [selfie.aiFaceValid, selfie.aiRealPerson, selfie.aiFaceMatch].filter(Boolean).length;
                const score = Math.round((passed / 3) * 100);
                const scoreBarColor =
                  score === 100 ? "bg-green-500" :
                  score >= 67   ? "bg-amber-400" :
                  score >= 33   ? "bg-orange-400" : "bg-red-500";
                const criteria = [
                  { pass: selfie.aiFaceValid,  label: "Valid Face", reason: selfie.aiReasoning?.[0] },
                  { pass: selfie.aiRealPerson, label: "Real Person", reason: selfie.aiReasoning?.[1] },
                  { pass: selfie.aiFaceMatch,  label: "Matches Profile", reason: selfie.aiReasoning?.[2] },
                ];

                return (
                  <div key={selfie.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <img
                        src={selfie.selfieUrl}
                        alt="Selfie"
                        className="w-12 h-12 object-cover rounded-lg cursor-pointer flex-shrink-0"
                        onClick={() => setViewerImage(selfie.selfieUrl)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-blue-600 truncate">{selfie.workerName}</p>
                          <StatusBadge status={selfie.aiStatus} />
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{formatDate(selfie.uploadedAt)}</p>
                        <button
                          onClick={() => setExpandedRow(isExpanded ? null : selfie.id)}
                          className="text-xs text-blue-600 hover:text-blue-800 mt-1 cursor-pointer"
                        >
                          {isExpanded ? "Hide details" : "View details"}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex gap-3 mb-3">
                          <div className="flex flex-col items-center gap-1">
                            <img
                              src={selfie.selfieUrl}
                              alt="Selfie"
                              className="w-20 h-20 object-cover rounded-xl cursor-pointer shadow-sm"
                              onClick={() => setViewerImage(selfie.selfieUrl)}
                            />
                            <span className="text-xs text-gray-400">Selfie</span>
                          </div>
                          {selfie.profileUrl && (
                            <div className="flex flex-col items-center gap-1">
                              <img
                                src={selfie.profileUrl}
                                alt="Profile"
                                className="w-20 h-20 object-cover rounded-xl cursor-pointer shadow-sm"
                                onClick={() => setViewerImage(selfie.profileUrl!)}
                              />
                              <span className="text-xs text-gray-400">Profile</span>
                            </div>
                          )}
                        </div>

                        <div className={`border rounded-xl px-4 py-3 ${
                          selfie.aiStatus === "approved" ? "border-green-200" : "border-red-200"
                        }`}>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                            AI Verification
                          </p>
                          <div className="mb-3">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs text-gray-500">Match Score</span>
                              <span className={`text-xs font-bold ${
                                score === 100 ? "text-green-600" :
                                score >= 67   ? "text-amber-500" :
                                score >= 33   ? "text-orange-500" : "text-red-500"
                              }`}>{score}%</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${scoreBarColor} transition-all duration-500`}
                                style={{ width: `${score}%` }}
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            {criteria.map(({ pass, label, reason }) => (
                              <div key={label} className="flex items-start gap-2">
                                {pass ? (
                                  <svg className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                                ) : (
                                  <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                )}
                                <div>
                                  <p className="text-sm font-medium text-gray-800">{label}</p>
                                  {reason && <p className="text-xs text-gray-500 mt-0.5">{reason}</p>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {data.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 md:px-4 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 cursor-pointer hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {data.page} of {data.totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                  disabled={page === data.totalPages}
                  className="px-3 md:px-4 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 cursor-pointer hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {viewerImage && (
        <ImageViewer
          src={viewerImage}
          alt="Image"
          onClose={() => setViewerImage(null)}
        />
      )}
    </div>
  );
}
