import React, { useState } from 'react';
import { type IncidentDTO, type IncidentSeverity } from '@mystore/contracts';
import {
  AlertTriangle,
  Clock,
  Plus,
  CheckCircle2,
  ChevronRight,
  Shield,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';

interface IncidentsViewProps {
  incidents?: IncidentDTO[];
  onCreateIncident?: (title: string, severity: IncidentSeverity, description: string, services: string[]) => Promise<void>;
  onDeleteIncident?: (id: string) => Promise<void>;
}

export function IncidentsView({
  incidents = [],
  onCreateIncident,
  onDeleteIncident,
}: IncidentsViewProps) {
  const [selectedIncident, setSelectedIncident] = useState<IncidentDTO | null>(
    incidents[0] || null
  );
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSeverity, setNewSeverity] = useState<IncidentSeverity>('SEV2');
  const [newDesc, setNewDesc] = useState('');
  const [newServices, setNewServices] = useState('sales-service, api-gateway');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDesc.trim()) {
      toast.error('Title and description are required.');
      return;
    }
    setIsSubmitting(true);
    try {
      const services = newServices.split(',').map((s) => s.trim()).filter(Boolean);
      await onCreateIncident?.(newTitle.trim(), newSeverity, newDesc.trim(), services);
      toast.success('Incident declared successfully.');
      setShowCreateModal(false);
      setNewTitle('');
      setNewDesc('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create incident');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'SEV1':
        return 'bg-destructive/20 text-destructive border-destructive/30';
      case 'SEV2':
        return 'bg-warning/20 text-warning border-warning/30';
      case 'SEV3':
        return 'bg-info/20 text-info border-info/30';
      default:
        return 'bg-muted text-foreground border-border';
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-card/60 border border-border/80">
        <div>
          <h2 className="text-sm font-bold text-foreground tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            Incident Commander & Triage Board
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Structured operational incident management, chronological timelines, and evidence preservation.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition shadow-md shadow-primary/20 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Declare Incident</span>
        </button>
      </div>

      {/* ── Master-Detail Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Incidents List */}
        <div className="rounded-xl bg-card/60 border border-border/80 p-3 space-y-2 max-h-[680px] overflow-y-auto">
          {incidents.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No operational incidents on file.
            </div>
          ) : (
            incidents.map((inc) => {
              const isSelected = selectedIncident?.id === inc.id;
              return (
                <div
                  key={inc.id}
                  onClick={() => setSelectedIncident(inc)}
                  className={`p-3 rounded-lg border transition-colors cursor-pointer space-y-2 ${
                    isSelected
                      ? 'bg-muted/90 border-primary/80 shadow-md'
                      : 'bg-card/60 border-border hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getSeverityBadge(inc.severity)}`}>
                      {inc.severity}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {inc.incidentNumber}
                    </span>
                  </div>

                  <div className="text-xs font-bold text-foreground truncate">{inc.title}</div>
                  <div className="text-[11px] text-muted-foreground line-clamp-2">{inc.description}</div>

                  <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono pt-1 border-t border-border/60">
                    <span className="text-primary font-semibold">{inc.status}</span>
                    <span>{new Date(inc.firstSeenAt).toLocaleTimeString()}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Incident Detail & Timeline */}
        <div className="lg:col-span-2 rounded-xl bg-card/60 border border-border/80 p-5 space-y-6">
          {selectedIncident ? (
            <>
              <div className="space-y-2 border-b border-border pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded text-xs font-bold border ${getSeverityBadge(selectedIncident.severity)}`}>
                      {selectedIncident.severity}
                    </span>
                    <span className="text-xs font-mono text-muted-foreground">{selectedIncident.incidentNumber}</span>
                  </div>
                  <span className="text-xs font-mono px-2.5 py-0.5 rounded bg-muted text-foreground font-bold">
                    {selectedIncident.status}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-foreground">{selectedIncident.title}</h3>
                  <button
                    onClick={async () => {
                      if (confirm('Are you sure you want to permanently delete this incident?')) {
                        await onDeleteIncident?.(selectedIncident.id);
                        setSelectedIncident(null);
                      }
                    }}
                    className="px-2 py-1 rounded bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-bold transition"
                  >
                    Delete (Admin)
                  </button>
                </div>
                <p className="text-xs text-foreground leading-relaxed">{selectedIncident.description}</p>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[11px] text-muted-foreground mr-1 self-center">Affected:</span>
                  {selectedIncident.affectedServices.map((svc) => (
                    <span key={svc} className="px-2 py-0.5 rounded bg-card border border-border text-[10px] font-mono text-primary">
                      {svc}
                    </span>
                  ))}
                </div>
              </div>

              {/* Chronological Timeline */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground uppercase tracking-wider font-mono">
                  <Clock className="w-4 h-4 text-primary" />
                  <span>Incident Chronological Timeline</span>
                </div>

                <div className="space-y-4 pl-3 border-l-2 border-border ml-2">
                  {selectedIncident.timeline.length === 0 ? (
                    <div className="text-xs text-muted-foreground italic">No timeline entries yet.</div>
                  ) : (
                    selectedIncident.timeline.map((item) => (
                      <div key={item.id} className="relative space-y-1">
                        <div className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-primary border-2 border-border" />
                        <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                          <span className="text-foreground font-bold">{new Date(item.timestamp).toLocaleTimeString()}</span>
                          <span>•</span>
                          <span className="text-primary font-semibold">{item.actionType}</span>
                          <span>by {item.actor}</span>
                        </div>
                        <p className="text-xs text-foreground">{item.description}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="py-20 text-center text-xs text-muted-foreground">
              Select an incident from the list to view timeline and evidence.
            </div>
          )}
        </div>
      </div>

      {/* ── Declare Incident Modal ── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreate}
            className="w-full max-w-md rounded-xl bg-card border border-border shadow-2xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 text-primary font-bold text-sm">
                <AlertTriangle className="w-4 h-4 text-warning" />
                <span>Declare Operational Incident</span>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-muted-foreground mb-1 font-mono">Incident Title</label>
                <input
                  type="text"
                  placeholder="e.g. Elevated 504 Timeouts in Catalog Microservice"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-card border border-border text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-muted-foreground mb-1 font-mono">Severity Level</label>
                <select
                  value={newSeverity}
                  onChange={(e) => setNewSeverity(e.target.value as IncidentSeverity)}
                  className="w-full px-3 py-2 rounded-lg bg-card border border-border text-foreground font-mono focus:outline-none focus:border-primary"
                >
                  <option value="SEV1">SEV1 — Critical Production Outage</option>
                  <option value="SEV2">SEV2 — Major Feature Degradation</option>
                  <option value="SEV3">SEV3 — Moderate Anomaly / High Latency</option>
                  <option value="SEV4">SEV4 — Minor Cosmetic / Low Priority</option>
                </select>
              </div>

              <div>
                <label className="block text-muted-foreground mb-1 font-mono">Affected Microservices (comma-separated)</label>
                <input
                  type="text"
                  value={newServices}
                  onChange={(e) => setNewServices(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-card border border-border text-foreground font-mono focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-muted-foreground mb-1 font-mono">Description &amp; Initial Symptoms</label>
                <textarea
                  rows={3}
                  placeholder="Describe initial symptoms, affected routes, and observed error rates..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-card border border-border text-foreground focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-lg bg-muted hover:bg-muted text-foreground text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition disabled:opacity-50 cursor-pointer shadow-md shadow-primary/20"
              >
                {isSubmitting ? 'Submitting...' : 'Declare Incident'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
