<script lang="ts">
  import { onMount } from 'svelte';
  import { apiGet, apiPost } from '../api';
  import { fmtDate, fmtNumber } from '../format';
  import { localizeAdminError, t } from '../i18n';
  import { auth } from '../state/auth.svelte';
  import type { GrowInfo } from '../types';
  import Panel from './Panel.svelte';

  // $GROW account card: authoritative balance, a credit/adjust form, and the
  // recent ledger. Credits route through POST /admin/api/accounts/:id/grow/credit
  // (actor = the signed-in admin, recorded server-side); the server enforces the
  // amount bounds and the never-below-zero guard regardless of this UI.
  let { accountId }: { accountId: number } = $props();

  // Mirrors the server bound (server/admin.ts GROW_ADJUST_MAX_ABS).
  const AMOUNT_MAX_ABS = 1_000_000;
  const REASON_MAX = 200;

  let info = $state<GrowInfo | null>(null);
  let loadFailed = $state(false);
  let amountText = $state('');
  let reason = $state('');
  let submitting = $state(false);

  async function refresh(): Promise<void> {
    try {
      info = await apiGet<GrowInfo>(`/admin/api/accounts/${accountId}/grow`);
      loadFailed = false;
    } catch (err) {
      if (!auth.handleAuthFailure(err)) loadFailed = true;
    }
  }

  function parsedAmount(): number | null {
    const value = Number(amountText.trim());
    if (!Number.isFinite(value) || !Number.isInteger(value)) return null;
    if (value === 0 || Math.abs(value) > AMOUNT_MAX_ABS) return null;
    return value;
  }

  async function submitCredit(): Promise<void> {
    const amount = parsedAmount();
    if (amount === null) {
      window.alert(t('grow.invalidAmount'));
      return;
    }
    if (!reason.trim()) {
      window.alert(t('grow.reasonRequired'));
      return;
    }
    submitting = true;
    try {
      await apiPost(`/admin/api/accounts/${accountId}/grow/credit`, {
        amount,
        reason: reason.trim(),
      });
      amountText = '';
      reason = '';
      await refresh();
    } catch (err) {
      if (!auth.handleAuthFailure(err)) {
        window.alert(
          err instanceof Error ? localizeAdminError(err.message) : t('alert.actionFailed'),
        );
      }
    } finally {
      submitting = false;
    }
  }

  onMount(() => {
    void refresh();
  });
</script>

<div class="grow-panel">
  <Panel title={t('grow.title')}>
    {#if loadFailed}
      <div class="empty">{t('grow.loadFailed')}</div>
    {:else if !info}
      <div class="empty">{t('grow.loading')}</div>
    {:else}
      <div class="grow-balance">
        <span class="grow-balance-label">{t('grow.balanceLabel')}</span>
        <span class="grow-balance-value">{fmtNumber(info.balance)}</span>
      </div>
      <div class="grow-credit-form">
        <input
          type="text"
          inputmode="numeric"
          bind:value={amountText}
          aria-label={t('grow.amountLabel')}
          placeholder={t('grow.amountPlaceholder')}
        />
        <input
          type="text"
          maxlength={REASON_MAX}
          bind:value={reason}
          aria-label={t('grow.reasonLabel')}
          placeholder={t('grow.reasonPlaceholder')}
        />
        <button
          class="btn-sm"
          disabled={submitting || !amountText.trim() || !reason.trim()}
          onclick={submitCredit}
        >
          {t('grow.creditButton')}
        </button>
      </div>
      <h4>{t('grow.ledgerHeader')}</h4>
      {#if info.ledger.length === 0}
        <div class="empty">{t('grow.ledgerEmpty')}</div>
      {:else}
        <table>
          <thead>
            <tr>
              <th>{t('grow.colWhen')}</th>
              <th class="num">{t('grow.colDelta')}</th>
              <th>{t('grow.colReason')}</th>
              <th>{t('grow.colActor')}</th>
            </tr>
          </thead>
          <tbody>
            {#each info.ledger as row (row.id)}
              <tr>
                <td>{fmtDate(row.createdAt)}</td>
                <td class="num">{row.delta > 0 ? `+${fmtNumber(row.delta)}` : fmtNumber(row.delta)}</td>
                <td>{row.reason}</td>
                <td>{row.actor || t('common.emptyValue')}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    {/if}
  </Panel>
</div>

<style>
  .grow-panel {
    margin-top: 18px;
  }

  .grow-balance {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 10px;
  }

  .grow-balance-value {
    font-size: 1.3em;
    font-weight: 600;
  }

  .grow-credit-form {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 12px;
  }

  .grow-credit-form input[inputmode='numeric'] {
    width: 9em;
  }

  .grow-credit-form input[type='text']:not([inputmode='numeric']) {
    flex: 1;
    min-width: 12em;
  }
</style>
