"use client";

import { WorkReview } from "./reviews";
import { useEffect, useState, type FormEvent } from "react";

type Api = <T>(path: string, method?: string, body?: unknown) => Promise<T>;
type Payment = {
  id: string;
  jobId: string;
  jobTitle: string;
  freelancerId: string;
  peerName: string;
  amountCents: number;
  status: string;
  completedAt?: string | null;
  reviewed?: boolean;
};
type PaymentList = { enabled: boolean; payments: Payment[] };
type Connect = { enabled: boolean; connected: boolean; ready: boolean };
const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function Payments({
  api,
  freelancer,
  returned,
}: {
  api: Api;
  freelancer: boolean;
  returned: string | null;
}) {
  const [data, setData] = useState<PaymentList>();
  const [connect, setConnect] = useState<Connect>();
  const [error, setError] = useState("");
  const [connectError, setConnectError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    setConnectError("");
    api<PaymentList>("/payments")
      .then((value) => {
        if (active) setData(value);
      })
      .catch((error: Error) => {
        if (active) setError(error.message);
      });
    if (freelancer)
      api<Connect>("/stripe/connect")
        .then((value) => {
          if (active) setConnect(value);
        })
        .catch((error: Error) => {
          if (active) setConnectError(error.message);
        });
    return () => {
      active = false;
    };
  }, [api, freelancer, revision]);
  async function onboard() {
    setBusy(true);
    setConnectError("");
    try {
      const { url } = await api<{ url: string }>("/stripe/connect", "POST");
      window.location.assign(url);
    } catch (error) {
      setConnectError((error as Error).message);
      setBusy(false);
    }
  }
  return (
    <section className="panel payments-panel">
      <div className="inbox-heading">
        <h2>Payments</h2>
        <button
          className="text-button"
          onClick={() => setRevision((value) => value + 1)}
        >
          Refresh payment status
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {data && !data.enabled && (
        <p>
          Stripe test payments are unavailable until the server is configured.
        </p>
      )}
      {returned === "checkout-return" && (
        <p role="status">
          Checkout returned. Refresh payment status after Stripe confirms the
          payment.
        </p>
      )}
      {returned === "checkout-cancel" && (
        <p role="status">
          Checkout was closed. Reopen the job to resume its pending payment.
        </p>
      )}
      {freelancer && (
        <section aria-label="Stripe onboarding">
          <h3>Stripe test account</h3>
          {connectError && <p role="alert">{connectError}</p>}
          {connect?.enabled &&
            (connect.ready ? (
              <p>Ready to receive test payments.</p>
            ) : (
              <button className="dark-button" onClick={onboard} disabled={busy}>
                {connect.connected
                  ? "Continue Stripe onboarding"
                  : "Connect with Stripe"}
              </button>
            ))}
        </section>
      )}
      <h3>Payment history</h3>
      {!data && !error && <p role="status">Loading payments…</p>}
      {data && !data.payments.length && <p>No payments yet.</p>}
      <ul className="conversation-list payment-list">
        {data?.payments.map((payment) => (
          <li key={payment.id}>
            <strong>{payment.jobTitle}</strong>
            <span>
              {payment.peerName} · {usd.format(payment.amountCents / 100)} ·{" "}
              {payment.status}
            </span>
            <WorkReview
              api={api}
              payment={payment}
              freelancer={freelancer}
              onChange={() => setRevision((v) => v + 1)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function JobCheckout({
  api,
  jobId,
  budget,
}: {
  api: Api;
  jobId: string;
  budget: number;
}) {
  const [details, setDetails] = useState<PaymentList>();
  const [peers, setPeers] = useState<{ peerId: string; peerName: string }[]>(
    [],
  );
  const [freelancerId, setFreelancerId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all([
      api<PaymentList>("/payments"),
      api<{ conversations: typeof peers }>("/conversations"),
    ])
      .then(([payments, inbox]) => {
        if (!active) return;
        setDetails(payments);
        setPeers(inbox.conversations);
      })
      .catch((error: Error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, [api]);
  async function checkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !payeeId) return;
    setBusy(true);
    setError("");
    try {
      const { url } = await api<{ url: string }>("/payments", "POST", {
        jobId,
        freelancerId: payeeId,
      });
      window.location.assign(url);
    } catch (error) {
      setError((error as Error).message);
      setBusy(false);
    }
  }
  const current = details?.payments.find((payment) => payment.jobId === jobId);
  const pending = current?.status === "pending";
  const payeeId = pending ? current.freelancerId : freelancerId;
  if (details && !details.enabled && !current) return null;
  return (
    <section className="payments-panel" aria-label="Job payment">
      <h3>Test payment</h3>
      {error && <p role="alert">{error}</p>}
      {current && (
        <p>
          {current.peerName} · {usd.format(current.amountCents / 100)} ·{" "}
          {current.status}
        </p>
      )}
      {details?.enabled &&
        current?.status !== "paid" &&
        (peers.length ? (
          <form onSubmit={checkout}>
            {!pending && (
              <label>
                Freelancer
                <select
                  value={freelancerId}
                  required
                  disabled={busy}
                  onChange={(event) => setFreelancerId(event.target.value)}
                >
                  <option value="">Choose from your conversations</option>
                  {peers.map((peer) => (
                    <option value={peer.peerId} key={peer.peerId}>
                      {peer.peerName}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button className="dark-button" disabled={!payeeId || busy}>
              {pending
                ? "Resume test checkout"
                : `Pay ${usd.format(budget)} in test mode`}
            </button>
          </form>
        ) : (
          <p>
            Start a conversation with a freelancer to pay them for this job.
          </p>
        ))}
    </section>
  );
}
