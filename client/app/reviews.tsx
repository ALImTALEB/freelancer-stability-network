"use client";
import { useEffect, useState, type FormEvent } from "react";
type Api = <T>(path: string, method?: string, body?: unknown) => Promise<T>;
export function Reputation({ api, userId }: { api: Api; userId: string }) {
  const [data, setData] = useState<{
    count: number;
    average: number | null;
    reviews: {
      id: string;
      rating: number;
      comment: string;
      reviewerName: string;
    }[];
  }>();
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api<typeof data>("/users/" + userId + "/reviews")
      .then((v) => {
        if (active) setData(v);
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [api, userId]);
  return (
    <section aria-label="Reviews">
      <h3>Ratings and reviews</h3>
      {error && <p role="alert">{error}</p>}
      {data && (
        <>
          <p>
            {data.count
              ? data.average + " / 5 · " + data.count + " reviews"
              : "No reviews yet."}
          </p>
          <ul>
            {data.reviews.map((r) => (
              <li key={r.id}>
                <strong>
                  {r.reviewerName} · {r.rating} / 5
                </strong>
                <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                  {r.comment}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
export function WorkReview({
  api,
  payment,
  freelancer,
  onChange,
}: {
  api: Api;
  payment: {
    id: string;
    status: string;
    completedAt?: string | null;
    reviewed?: boolean;
  };
  freelancer: boolean;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function mutate(path: string, body?: unknown) {
    setBusy(true);
    setError("");
    try {
      await api(path, "POST", body);
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void mutate("/reviews", {
      paymentId: payment.id,
      rating: Number(f.get("rating")),
      comment: f.get("comment"),
    });
  }
  if (payment.status !== "paid") return null;
  return (
    <section aria-label="Work completion and review">
      {error && <p role="alert">{error}</p>}
      {!payment.completedAt ? (
        freelancer ? (
          <p>Waiting for the client to mark work complete.</p>
        ) : (
          <button
            className="dark-button"
            disabled={busy}
            onClick={() => void mutate("/payments/" + payment.id + "/complete")}
          >
            Mark work complete
          </button>
        )
      ) : payment.reviewed ? (
        <p>Work completed · Your review has been submitted.</p>
      ) : (
        <form onSubmit={submit}>
          <p>Work completed. Review your project partner.</p>
          <label>
            Rating
            <select name="rating" defaultValue="5">
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} / 5
                </option>
              ))}
            </select>
          </label>
          <label>
            Review
            <textarea name="comment" required minLength={1} maxLength={2000} />
          </label>
          <button className="dark-button" disabled={busy}>
            Submit review
          </button>
        </form>
      )}
    </section>
  );
}
