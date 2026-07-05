import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { Contract } from "@/types";
import { fetchContracts, fetchArtists, createContract, deleteContract, restoreContract } from "@/utils/api";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useUndoableDelete } from "@/hooks/useUndoableDelete";
import type { Artist } from "@/types";
import { SearchInput } from "@/components/ui/SearchInput";
import { FilterBar } from "@/components/ui/FilterBar";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PageLoader } from "@/components/ui/PageLoader";
import { ErrorState } from "@/components/ui/ErrorState";
import { ContractCard } from "./ContractCard";
import { ContractDetail } from "./ContractDetail";

const STATUS_FILTERS = [
  { label: "Signed", value: "signed" },
  { label: "Sent", value: "sent" },
  { label: "Draft", value: "draft" },
  { label: "Expired", value: "expired" },
];

const TYPE_FILTERS = [
  { label: "Exclusive", value: "exclusive" },
  { label: "Distribution", value: "distribution" },
  { label: "Non-Exclusive", value: "non_exclusive" },
  { label: "Licensing", value: "licensing" },
];

type ContractType = "exclusive" | "non_exclusive" | "distribution" | "licensing";

export function ContractPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isOnline } = useNetworkStatus();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newArtist, setNewArtist] = useState("");
  const [newArtistId, setNewArtistId] = useState("");
  const [newType, setNewType] = useState<ContractType>("exclusive");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [contractsData, artistsData] = await Promise.all([
        fetchContracts(),
        fetchArtists(),
      ]);
      setContracts(contractsData);
      setArtists(artistsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load contracts");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateContract(e: React.FormEvent) {
    e.preventDefault();
    if (!newArtist.trim()) return;
    try {
      const created = await createContract({
        artist: newArtist.trim(),
        artistId: newArtistId,
        type: newType,
        status: "draft",
      });
      setContracts((prev) => [created, ...prev]);
      setNewArtist("");
      setNewArtistId("");
      setNewType("exclusive");
      setShowNewForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create contract");
    }
  }

  const filtered = contracts.filter((contract) => {
    const matchesSearch =
      contract.artist.toLowerCase().includes(search.toLowerCase()) ||
      contract.type.toLowerCase().includes(search.toLowerCase()) ||
      (contract.nextAction ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || contract.status === statusFilter;
    const matchesType =
      typeFilter === "all" || contract.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  function handleContractUpdated(updated: Contract) {
    setContracts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  function handleContractDeleted(id: string) {
    setContracts((prev) => prev.filter((c) => c.id !== id));
  }

  /** Card-row delete + undo flow. Routes through useUndoableDelete so
   *  the user gets a 5 s undo window on the toast; this handler only
   *  owns the post-delete routing (close the open detail panel). */
  const { delete: deleteContractRow } = useUndoableDelete<Contract>({
    apiDelete: deleteContract,
    apiRestore: restoreContract,
    items: contracts,
    setItems: setContracts,
    labelFn: (c) => `Contract with ${c.artist}`,
  });

  async function handleContractCardDelete(contract: Contract) {
    await deleteContractRow(contract);
    if (id === contract.id) navigate("/contracts");
  }

  const selectedContract = id
    ? contracts.find((c) => c.id === id) ?? null
    : null;

  if (loading) {
    return <PageLoader message="" />;
  }

  return (
    <div className="space-y-6">
      {/* Header with search and add button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeader
          title="Contracts"
          subtitle={`${contracts.length} total • ${filtered.length} shown`}
        />
        <div className="flex items-center gap-3">
          <div className="w-full sm:w-56">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search contracts..."
            />
          </div>
          <button
            onClick={() => setShowNewForm(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-cyan-500/10 px-3.5 py-2 text-xs font-medium text-cyan-400 transition-all hover:bg-cyan-500/20 hover:text-cyan-300"
          >
            <span className="text-base leading-none">+</span>
            <span className="hidden sm:inline">New Contract</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-6">
        <FilterBar
          label="Status"
          options={STATUS_FILTERS}
          selected={statusFilter}
          onChange={setStatusFilter}
        />
        <FilterBar
          label="Type"
          options={TYPE_FILTERS}
          selected={typeFilter}
          onChange={setTypeFilter}
        />
      </div>

      {/* Error — offline-aware */}
      {error && (
        <ErrorState
          message={!isOnline ? "You appear to be offline — check your connection and try again" : error}
          onRetry={loadData}
        />
      )}

      {/* List */}
      {!error && filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 px-6 py-16 text-center">
          <span className="mb-3 text-3xl text-zinc-600 aura-float">◇</span>
          <p className="text-sm font-medium text-zinc-400">No contracts found</p>
          <p className="mt-1 text-xs text-zinc-600">
            {contracts.length === 0
              ? 'Add your first contract with the "+ New Contract" button'
              : "Try adjusting your search or filters"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((contract, i) => (
            <div key={contract.id} className={`aura-enter-fade-up aura-stagger-${(i % 6) + 1}`}>
              <ContractCard
                contract={contract}
                onClick={() => navigate(`/contracts/${contract.id}`)}
                onDelete={() => void handleContractCardDelete(contract)}
              />
            </div>
          ))}
        </div>
      )}

      {selectedContract && (
        <ContractDetail
          contract={selectedContract}
          onClose={() => navigate("/contracts")}
          onUpdated={handleContractUpdated}
          onDeleted={handleContractDeleted}
        />
      )}

      {/* New Contract modal */}
      {showNewForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowNewForm(false)}
          />
          <div className="relative w-full max-w-md rounded-xl border border-zinc-800/60 bg-zinc-950 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">New Contract</h3>
              <button
                onClick={() => setShowNewForm(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-800/50 text-xs text-zinc-400 hover:bg-zinc-700/50 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateContract} className="space-y-4">
              {/* Artist select */}
              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  Artist
                </label>
                <select
                  value={newArtistId}
                  onChange={(e) => {
                    const selected = artists.find((a) => a.id === e.target.value);
                    setNewArtistId(e.target.value);
                    setNewArtist(selected?.name ?? "");
                  }}
                  className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                >
                  <option value="">Select an artist...</option>
                  {artists.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Contract type */}
              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  Type
                </label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as ContractType)}
                  className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                >
                  <option value="exclusive">Exclusive</option>
                  <option value="non_exclusive">Non-Exclusive</option>
                  <option value="distribution">Distribution</option>
                  <option value="licensing">Licensing</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewForm(false)}
                  className="rounded-lg px-3.5 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newArtistId}
                  className="rounded-lg bg-cyan-500/10 px-4 py-2 text-xs font-medium text-cyan-400 transition-all hover:bg-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Create Contract
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
