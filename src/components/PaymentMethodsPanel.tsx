import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  deleteCreditCard,
  deleteWalletMethod,
  insertCreditCard,
  insertWalletMethod,
  loadCreditCards,
  loadWalletMethods,
  updateCreditCard,
  updateWalletMethod,
} from "../db/repo";
import type { CreditCard, WalletMethod } from "../types";
import { creditCardPrimaryLine } from "../lib/creditCardDisplay";
import { tCardBrand, tPaymentService } from "../lib/i18nLabels";
import { PAYMENT_SERVICES, CARD_BRANDS } from "../lib/paymentCatalog";
import { cardExpiryProgress, DUE_TONE_BAR, DUE_TONE_TRACK } from "../lib/dueProgress";
import { ConfirmDialog } from "./ConfirmDialog";

export function PaymentMethodsPanel() {
  const { t } = useTranslation();
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [wallets, setWallets] = useState<WalletMethod[]>([]);
  const [tab, setTab] = useState<"card" | "wallet">("wallet");

  const reload = useCallback(async () => {
    const [c, w] = await Promise.all([loadCreditCards(), loadWalletMethods()]);
    setCards(c);
    setWallets(w);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          className={`dash-chip ${tab === "wallet" ? "dash-chip-active" : "dash-chip-idle"}`}
          onClick={() => setTab("wallet")}
        >
          {t("payment.walletTab")}
        </button>
        <button
          type="button"
          className={`dash-chip ${tab === "card" ? "dash-chip-active" : "dash-chip-idle"}`}
          onClick={() => setTab("card")}
        >
          {t("payment.cardTab")}
        </button>
      </div>

      {tab === "wallet" ? (
        <WalletSection cards={cards} wallets={wallets} onChanged={reload} />
      ) : (
        <CardSection cards={cards} onChanged={reload} />
      )}
    </div>
  );
}

function WalletSection({
  cards,
  wallets,
  onChanged,
}: {
  cards: CreditCard[];
  wallets: WalletMethod[];
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [service, setService] = useState("PAYPAL");
  const [account, setAccount] = useState("");
  const [linkCard, setLinkCard] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!account.trim()) return;
    await insertWalletMethod({
      service_code: service,
      account_text: account.trim(),
      linked_card_id: linkCard ? parseInt(linkCard, 10) : null,
    });
    setAccount("");
    setLinkCard("");
    onChanged();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="dash-home-panel space-y-3 p-3">
        <h3 className="font-semibold text-cream-900">{t("payment.addWallet")}</h3>
        <div>
          <label className="sk-label">{t("payment.serviceName")}</label>
          <select className="sk-select" value={service} onChange={(e) => setService(e.target.value)}>
            {PAYMENT_SERVICES.map((s) => (
              <option key={s.code} value={s.code}>
                {tPaymentService(t, s.code)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="sk-label">{t("payment.accountOnService")}</label>
          <input className="sk-input" value={account} onChange={(e) => setAccount(e.target.value)} />
        </div>
        <div>
          <label className="sk-label">{t("payment.optionalLinkCard")}</label>
          <select className="sk-select" value={linkCard} onChange={(e) => setLinkCard(e.target.value)}>
            <option value="">{t("common.none")}</option>
            {cards.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {creditCardPrimaryLine(c, tCardBrand(t, c.brand))}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-cream-600">{t("payment.savedCardPickerHint")}</p>
        </div>
        <button type="submit" className="sk-btn-primary">
          {t("payment.saveWallet")}
        </button>
      </form>

      <ul className="dash-home-panel divide-y divide-cream-400/40 overflow-hidden">
        {wallets.length === 0 ? (
          <li className="px-4 py-3 text-sm sk-text-hint">{t("payment.noWallets")}</li>
        ) : (
          wallets.map((w) => (
            <WalletRow key={w.id} w={w} cards={cards} onChanged={onChanged} />
          ))
        )}
      </ul>
    </div>
  );
}

function WalletRow({
  w,
  cards,
  onChanged,
}: {
  w: WalletMethod;
  cards: CreditCard[];
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [edit, setEdit] = useState(false);
  const [service, setService] = useState(w.service_code);
  const [account, setAccount] = useState(w.account_text);
  const [linkCard, setLinkCard] = useState(w.linked_card_id != null ? String(w.linked_card_id) : "");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    setService(w.service_code);
    setAccount(w.account_text);
    setLinkCard(w.linked_card_id != null ? String(w.linked_card_id) : "");
  }, [w]);

  async function save() {
    await updateWalletMethod(w.id, {
      service_code: service,
      account_text: account,
      linked_card_id: linkCard ? parseInt(linkCard, 10) : null,
    });
    setEdit(false);
    onChanged();
  }

  async function del() {
    await deleteWalletMethod(w.id);
    setDeleteConfirmOpen(false);
    onChanged();
  }

  const svc = tPaymentService(t, w.service_code);

  if (edit) {
    return (
      <li className="sk-card space-y-4">
        <p className="font-semibold text-cream-900">{t("payment.editWalletTitle")}</p>
        <div>
          <label className="sk-label">{t("payment.serviceName")}</label>
          <select className="sk-select" value={service} onChange={(e) => setService(e.target.value)}>
            {PAYMENT_SERVICES.map((s) => (
              <option key={s.code} value={s.code}>
                {tPaymentService(t, s.code)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="sk-label">{t("payment.accountOnService")}</label>
          <input className="sk-input" value={account} onChange={(e) => setAccount(e.target.value)} />
        </div>
        <div>
          <label className="sk-label">{t("payment.savedCardPickerLabel")}</label>
          <select className="sk-select" value={linkCard} onChange={(e) => setLinkCard(e.target.value)}>
            <option value="">{t("common.none")}</option>
            {cards.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {creditCardPrimaryLine(c, tCardBrand(t, c.brand))}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-cream-600">{t("payment.savedCardPickerHint")}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="sk-btn-primary text-sm" onClick={() => void save()}>
            {t("common.save")}
          </button>
          <button type="button" className="sk-btn-secondary text-sm" onClick={() => setEdit(false)}>
            {t("common.cancel")}
          </button>
        </div>
      </li>
    );
  }

  return (
    <>
      <ConfirmDialog
        open={deleteConfirmOpen}
        title={t("confirmDialog.deleteTitle")}
        message={t("payment.confirmDeleteWallet")}
        variant="danger"
        confirmLabel={t("common.delete")}
        onConfirm={() => void del()}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
      <li className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-cream-900">{svc}</p>
          <p className="text-sm text-cream-800">{w.account_text}</p>
          {w.linked_card_id ? (
            <p className="text-xs text-cream-600">
              {t("payment.linkedCard")}:{" "}
              {(() => {
                const lc = cards.find((c) => c.id === w.linked_card_id);
                return lc
                  ? creditCardPrimaryLine(
                      lc,
                      tCardBrand(t, lc.brand),
                    )
                  : "—";
              })()}
            </p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <button type="button" className="sk-btn-secondary text-sm" onClick={() => setEdit(true)}>
            {t("common.edit")}
          </button>
          <button type="button" className="sk-btn-danger text-sm" onClick={() => setDeleteConfirmOpen(true)}>
            {t("common.delete")}
          </button>
        </div>
      </li>
    </>
  );
}

function CardSection({
  cards,
  onChanged,
}: {
  cards: CreditCard[];
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [brand, setBrand] = useState("VISA");
  const [last4, setLast4] = useState("");
  const [description, setDescription] = useState("");
  const [expM, setExpM] = useState(String(new Date().getMonth() + 1));
  const [expY, setExpY] = useState(String(new Date().getFullYear()));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const d = last4.replace(/\D/g, "").slice(0, 4);
    if (d.length !== 4) return;
    const m = parseInt(expM, 10);
    const y = parseInt(expY, 10);
    if (m < 1 || m > 12 || y < 2000) return;
    await insertCreditCard({
      brand,
      last4: d,
      exp_month: m,
      exp_year: y,
      description: description.trim() || null,
    });
    setLast4("");
    setDescription("");
    onChanged();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="dash-home-panel space-y-3 p-3">
        <h3 className="font-semibold text-cream-900">{t("payment.addCard")}</h3>
        <div>
          <label className="sk-label">{t("payment.cardBrand")}</label>
          <select className="sk-select" value={brand} onChange={(e) => setBrand(e.target.value)}>
            {CARD_BRANDS.map((b) => (
              <option key={b.code} value={b.code}>
                {tCardBrand(t, b.code)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="sk-label">{t("payment.cardDescription")}</label>
          <textarea
            className="sk-textarea"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("payment.cardDescriptionPlaceholder")}
          />
          <p className="mt-1 text-xs text-cream-600">{t("payment.cardDescriptionHint")}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="sk-label">{t("payment.cardLast4")}</label>
            <input
              className="sk-input font-mono"
              value={last4}
              maxLength={4}
              onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
            />
          </div>
          <div>
            <label className="sk-label">{t("payment.cardExpMonth")}</label>
            <input
              type="number"
              min={1}
              max={12}
              className="sk-input"
              value={expM}
              onChange={(e) => setExpM(e.target.value)}
            />
          </div>
          <div>
            <label className="sk-label">{t("payment.cardExpYear")}</label>
            <input
              type="number"
              min={2020}
              max={2100}
              className="sk-input"
              value={expY}
              onChange={(e) => setExpY(e.target.value)}
            />
          </div>
        </div>
        <button type="submit" className="sk-btn-primary">
          {t("payment.saveCard")}
        </button>
      </form>

      <ul className="dash-home-panel divide-y divide-cream-400/40 overflow-hidden">
        {cards.length === 0 ? (
          <li className="px-4 py-3 text-sm sk-text-hint">{t("payment.noCards")}</li>
        ) : (
          cards.map((c) => <CardRow key={c.id} c={c} onChanged={onChanged} />)
        )}
      </ul>
    </div>
  );
}

function CardRow({ c, onChanged }: { c: CreditCard; onChanged: () => void }) {
  const { t } = useTranslation();
  const [edit, setEdit] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [brand, setBrand] = useState(c.brand);
  const [last4, setLast4] = useState(c.last4);
  const [description, setDescription] = useState(c.description ?? "");
  const [expM, setExpM] = useState(String(c.exp_month));
  const [expY, setExpY] = useState(String(c.exp_year));

  useEffect(() => {
    setBrand(c.brand);
    setLast4(c.last4);
    setDescription(c.description ?? "");
    setExpM(String(c.exp_month));
    setExpY(String(c.exp_year));
  }, [c]);

  const xp = cardExpiryProgress(c.exp_month, c.exp_year);
  const tone =
    xp.monthsLeft < 0 ? "overdue" : xp.urgent ? "urgent" : xp.ratio > 0.75 ? "warn" : "safe";

  async function save() {
    const d = last4.replace(/\D/g, "").slice(0, 4);
    if (d.length !== 4) return;
    const m = parseInt(expM, 10);
    const y = parseInt(expY, 10);
    await updateCreditCard(c.id, {
      brand,
      last4: d,
      exp_month: m,
      exp_year: y,
      description: description.trim() || null,
    });
    setEdit(false);
    onChanged();
  }

  async function del() {
    await deleteCreditCard(c.id);
    setDeleteConfirmOpen(false);
    onChanged();
  }

  const label = tCardBrand(t, c.brand);

  if (edit) {
    return (
      <li className="sk-card space-y-4">
        <p className="font-semibold text-cream-900">{t("payment.editCardTitle")}</p>
        <div>
          <label className="sk-label">{t("payment.cardBrand")}</label>
          <select className="sk-select" value={brand} onChange={(e) => setBrand(e.target.value)}>
            {CARD_BRANDS.map((b) => (
              <option key={b.code} value={b.code}>
                {tCardBrand(t, b.code)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="sk-label">{t("payment.cardDescription")}</label>
          <textarea
            className="sk-textarea"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("payment.cardDescriptionPlaceholder")}
          />
          <p className="mt-1 text-xs text-cream-600">{t("payment.cardDescriptionHint")}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="sk-label">{t("payment.cardLast4")}</label>
            <input className="sk-input font-mono" value={last4} maxLength={4} onChange={(e) => setLast4(e.target.value)} />
          </div>
          <div>
            <label className="sk-label">{t("payment.cardExpMonth")}</label>
            <input type="number" className="sk-input w-full min-w-0" value={expM} onChange={(e) => setExpM(e.target.value)} />
          </div>
          <div>
            <label className="sk-label">{t("payment.cardExpYear")}</label>
            <input type="number" className="sk-input w-full min-w-0" value={expY} onChange={(e) => setExpY(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" className="sk-btn-primary text-sm" onClick={() => void save()}>
            {t("common.save")}
          </button>
          <button type="button" className="sk-btn-secondary text-sm" onClick={() => setEdit(false)}>
            {t("common.cancel")}
          </button>
        </div>
      </li>
    );
  }

  return (
    <>
      <ConfirmDialog
        open={deleteConfirmOpen}
        title={t("confirmDialog.deleteTitle")}
        message={t("payment.confirmDeleteCard")}
        variant="danger"
        confirmLabel={t("common.delete")}
        onConfirm={() => void del()}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
      <li className="space-y-2 px-3 py-2.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-semibold text-cream-900">
              {label} ·••• {c.last4}
            </p>
            {(c.description ?? "").trim() ? (
              <p className="text-sm text-cream-800">{(c.description ?? "").trim()}</p>
            ) : null}
            <p className="text-sm text-cream-700">
              {t("payment.expiresShort", { m: c.exp_month, y: c.exp_year })}
            </p>
            <p className="text-xs text-cream-600">
              {xp.monthsLeft < 0
                ? t("payment.cardExpired")
                : t("payment.monthsUntilExpiry", { count: xp.monthsLeft })}
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="sk-btn-secondary text-sm" onClick={() => setEdit(true)}>
              {t("common.edit")}
            </button>
            <button type="button" className="sk-btn-danger text-sm" onClick={() => setDeleteConfirmOpen(true)}>
              {t("common.delete")}
            </button>
          </div>
        </div>
        <div
          className={`overflow-hidden rounded-full ${DUE_TONE_TRACK[tone]} h-2 shadow-inner`}
          title={t("payment.expiryBarHint")}
        >
          <div
            className={`${DUE_TONE_BAR[tone]} h-2 rounded-full transition-[width]`}
            style={{ width: `${Math.min(100, Math.round(xp.ratio * 100))}%` }}
          />
        </div>
      </li>
    </>
  );
}
