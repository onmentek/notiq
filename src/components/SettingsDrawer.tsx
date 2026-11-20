"use client";

import {
  CheckCircle2,
  Cloud,
  Download,
  FileText,
  Keyboard,
  RefreshCw,
  Shield,
  Smartphone,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { useRef, useState } from "react";
import { checkServerHealth, isNativeApp } from "@/lib/storage";
import type { Note, SyncConfig, SyncStatus } from "@/lib/types";

interface SettingsDrawerProps {
  syncConfig: SyncConfig;
  syncStatus: SyncStatus;
  notes: Note[];
  onClose: () => void;
  onSaveSyncConfig: (config: SyncConfig) => void;
  onSyncNow: () => void;
  onExportJson: () => void;
  onExportMarkdown: () => void;
  onImportJson: (imported: Note[]) => void;
}

export function SettingsDrawer({
  syncConfig,
  syncStatus,
  notes,
  onClose,
  onSaveSyncConfig,
  onSyncNow,
  onExportJson,
  onExportMarkdown,
  onImportJson,
}: SettingsDrawerProps) {
  const [serverUrl, setServerUrl] = useState(syncConfig.serverUrl);
  const [syncSecret, setSyncSecret] = useState(syncConfig.syncSecret);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [testing, setTesting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const native = isNativeApp();

  const handleSaveAndTest = async () => {
    const nextConfig: SyncConfig = {
      ...syncConfig,
      serverUrl: serverUrl.trim(),
      syncSecret: syncSecret.trim(),
    };
    onSaveSyncConfig(nextConfig);

    setTesting(true);
    setTestResult(null);
    const result = await checkServerHealth(nextConfig);
    setTesting(false);
    if (result.ok) {
      setTestResult({
        ok: true,
        message: `Bağlantı başarılı (${result.mode === "turso" ? "Turso Bulut" : "Yerel libSQL"})`,
      });
      onSyncNow();
    } else {
      setTestResult({
        ok: false,
        message: result.error || "Sunucuya ulaşılamadı",
      });
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const list = Array.isArray(parsed) ? parsed : parsed?.notes;
      if (Array.isArray(list)) {
        onImportJson(list as Note[]);
        setTestResult({
          ok: true,
          message: `${list.length} not içe aktarıldı.`,
        });
      }
    } catch {
      setTestResult({ ok: false, message: "Geçersiz JSON yedek dosyası." });
    } finally {
      e.target.value = "";
    }
  };

  const activeCount = notes.filter((n) => !n.deletedAt && !n.isArchived).length;

  return (
    <div
      className="glass-backdrop animate-fade-in fixed inset-0 z-50 flex justify-end"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="glass-strong animate-switch-next safe-top safe-bottom flex h-full w-full max-w-md flex-col overflow-hidden rounded-l-3xl border-y-0 border-r-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
          <div>
            <h2 className="text-base font-bold tracking-tight">
              Ayarlar & Senkronizasyon
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Vercel + Turso bulut eşitleme ve veri yönetimi
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Ayarları kapat"
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/5 text-[var(--text-primary)] transition hover:bg-black/10 dark:bg-white/8 dark:hover:bg-white/15"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {/* Cloud Sync Section */}
          <section className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-black/[0.025] p-4 dark:bg-white/[0.025]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Cloud className="h-4 w-4 text-blue-500" />
                <span>Vercel + Turso Bağlantısı</span>
              </div>
              <span className="rounded-full bg-blue-500/12 px-2 py-0.5 text-[10.5px] font-medium text-blue-600 dark:text-blue-300">
                {syncStatus === "synced"
                  ? "Eşitlendi"
                  : syncStatus === "syncing"
                    ? "Eşitleniyor"
                    : "Yerel Mod"}
              </span>
            </div>

            {native && (
              <div className="flex items-start gap-2 rounded-xl bg-blue-500/10 p-2.5 text-xs text-blue-700 dark:text-blue-200">
                <Smartphone className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Android APK yerel çevrimdışı çalışır. Web ile canlı eşitlemek için
                  Vercel adresinizi aşağıya girin.
                </span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">
                Sunucu URL {native ? "(Vercel Adresin)" : "(Boş = Mevcut Alan Adı)"}
              </label>
              <input
                type="url"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="https://notiq.vercel.app"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm outline-none focus:border-blue-500/60"
              />
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
                <Shield className="h-3.5 w-3.5" />
                <span>Sync Anahtarı (Opsiyonel SYNC_SECRET)</span>
              </label>
              <input
                type="password"
                value={syncSecret}
                onChange={(e) => setSyncSecret(e.target.value)}
                placeholder="Vercel ortam değişkeni ile eşleşen anahtar"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm outline-none focus:border-blue-500/60"
              />
            </div>

            {testResult && (
              <div
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium ${
                  testResult.ok
                    ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300"
                    : "bg-rose-500/12 text-rose-600 dark:text-rose-300"
                }`}
              >
                {testResult.ok ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                disabled={testing}
                onClick={handleSaveAndTest}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${testing ? "animate-spin" : ""}`} />
                <span>Kaydet & Test Et</span>
              </button>
              <button
                type="button"
                onClick={onSyncNow}
                className="rounded-xl border border-[var(--border-strong)] px-3 py-2 text-xs font-medium transition hover:bg-black/5 dark:hover:bg-white/8"
              >
                Şimdi Eşitle
              </button>
            </div>
          </section>

          {/* Backup & Portability */}
          <section className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-black/[0.025] p-4 dark:bg-white/[0.025]">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Yedekleme & Taşıma</span>
              <span className="text-xs tabular-nums text-[var(--text-muted)]">
                {activeCount} aktif not
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={onExportJson}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-2.5 text-xs font-medium transition hover:border-blue-500/40"
              >
                <Download className="h-4 w-4 text-blue-500" />
                <span>JSON Al</span>
              </button>
              <button
                type="button"
                onClick={onExportMarkdown}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-2.5 text-xs font-medium transition hover:border-blue-500/40"
              >
                <FileText className="h-4 w-4 text-emerald-500" />
                <span>Markdown</span>
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-2.5 text-xs font-medium transition hover:border-blue-500/40"
              >
                <Upload className="h-4 w-4 text-amber-500" />
                <span>İçe Aktar</span>
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              onChange={handleFileImport}
              className="hidden"
            />
          </section>

          {/* Keyboard Shortcuts Reference */}
          <section className="space-y-2.5 rounded-2xl border border-[var(--border-subtle)] bg-black/[0.025] p-4 dark:bg-white/[0.025]">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Keyboard className="h-4 w-4 text-indigo-500" />
              <span>Hızlı Klavye Kısayolları</span>
            </div>
            <div className="space-y-1.5 text-xs">
              {[
                ["⌘K / Ctrl+K", "Yarı saydam Komut & Arama Paleti"],
                ["/", "Anlık arama çubuğuna odaklan"],
                ["N", "Yeni hızlı not başlat"],
                ["1 – 5", "İlk 5 öncelikli kartı tek tuşla aç"],
                ["Space", "Üzerindeki kartta yarı saydam Hızlı Bakış"],
                ["Enter", "Kartı aç & üstten hemen yaz"],
                ["Alt + ← / →", "Açık kartlar arasında anında geçiş"],
                ["Esc", "Otomatik kaydet & kapat"],
              ].map(([keys, desc]) => (
                <div
                  key={keys}
                  className="flex items-center justify-between gap-2 py-0.5"
                >
                  <span className="text-[var(--text-secondary)]">{desc}</span>
                  <kbd className="shrink-0 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono text-[10.5px] text-[var(--text-primary)]">
                    {keys}
                  </kbd>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
