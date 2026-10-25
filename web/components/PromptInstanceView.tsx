import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import RevealWatcher from "@/components/RevealWatcher";
import AnswerForm from "@/components/AnswerForm";
import DiscussionForm from "@/components/DiscussionForm";
import SoftPremiumCard from "@/components/SoftPremiumCard";
import NudgePerson from "@/components/NudgePerson";
import ReactionBar from "@/components/ReactionBar";
import ShareMilestone from "@/components/ShareMilestone";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { groupReactions, isReactionEmoji, reactionKey } from "@/lib/reactions";
import { dimensionLabel, isDimensionScored, quizReflection } from "@/lib/quizResult";
import {
  ANSWER_FIRST,
  EMPTY_STATE,
  FIRST_REVEAL_UNLOCK,
  REVEALED,
  WAITING_ON_THEM,
  WAITING_ON_YOU,
} from "@/lib/firstRevealCopy";
import type { PromptQuestion } from "@/lib/database.types";

type AnswerMap = Record<string, string>;

// Renders a single prompt instance for the current user: empty / waiting-on-them
// / waiting-on-you while open, then the first-reveal unlock + discussion once
// everyone has answered. Shared by onboarding and daily.
export default async function PromptInstanceView({
  connectionId,
  instanceId,
  title,
}: {
  connectionId: string;
  instanceId: string;
  title: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: instance } = await supabase
    .from("prompt_instances")
    .select("id, questions, status, template_id")
    .eq("id", instanceId)
    .maybeSingle();

  if (!instance) {
    return (
      <div className="page has-tabbar">
        <p className="text-ink-soft">This question is no longer available.</p>
        <Link href={`/connections/${connectionId}`} className="link mt-2 inline-block">
          Back to the connection
        </Link>
      </div>
    );
  }

  // Prefer the template's own title (e.g. a specific quiz/challenge name).
  // The config says whether the quiz has per-dimension scoring to reflect on.
  let heading = title;
  let scored = false;
  if (instance.template_id) {
    const { data: tmpl } = await supabase
      .from("prompt_templates")
      .select("title, config")
      .eq("id", instance.template_id)
      .maybeSingle();
    if (tmpl?.title) heading = tmpl.title;
    scored = isDimensionScored(tmpl?.config);
  }

  const questions = instance.questions as PromptQuestion[];
  const { data: responses } = await supabase
    .from("prompt_responses")
    .select("user_id, answers")
    .eq("instance_id", instance.id);
  const myResponse = (responses ?? []).find((r) => r.user_id === user?.id);
  const myAnswers = (myResponse?.answers ?? {}) as AnswerMap;
  const answered = !!myResponse;

  // Boolean-only: another member has content (no answer text). Needed when
  // you haven't answered yet — RLS hides their row until you share too.
  const { data: othersAnswered } = await supabase.rpc("others_have_answered", {
    p_instance: instance.id,
  });

  // Answer-first: before the other person joins, "nudge them" can't work
  // (they can't open the connection yet), so point back at the invite.
  const { count: joinedCount } = await supabase
    .from("connection_members")
    .select("user_id", { count: "exact", head: true })
    .eq("connection_id", connectionId)
    .not("joined_at", "is", null);
  const partnerJoined = (joinedCount ?? 0) >= 2;
  const inviteHref = `/connections/${connectionId}#invite`;

  let myName: string | null = null;
  if (user) {
    const { data: me } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();
    myName = me?.display_name?.trim() || null;
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const connectionUrl = `${site}/connections/${connectionId}`;

  // The big "You revealed together" hero and the soft Premium card belong to
  // the connection's first mutual reveal only; later reveals get a quieter
  // header so the daily loop doesn't shout every day.
  let isFirstReveal = false;
  let isPremium = false;
  if (instance.status === "revealed" && user) {
    const { data: revealedRows } = await supabase
      .from("prompt_instances")
      .select("id")
      .eq("connection_id", connectionId)
      .eq("status", "revealed");
    isFirstReveal = (revealedRows ?? []).length === 1;
    const { data: premium } = await supabase.rpc("connection_has_premium", {
      p_conn: connectionId,
    });
    isPremium = !!premium;
  }

  // ---- Revealed (first unlock hero) ----
  if (instance.status === "revealed") {
    const { data: members } = await supabase
      .from("connection_members")
      .select("user_id")
      .eq("connection_id", connectionId);
    const ids = (members ?? []).map((m) => m.user_id);
    const { data: profiles } = await supabase
      .from("partner_profiles")
      .select("id, display_name, username")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const nameOf = (uid: string) => {
      if (uid === user?.id) return "You";
      const p = profiles?.find((x) => x.id === uid);
      return p?.display_name || p?.username || "Them";
    };
    const avatarName = (uid: string) => {
      if (uid === user?.id) return myName ?? "You";
      const p = profiles?.find((x) => x.id === uid);
      return p?.display_name || p?.username || "?";
    };

    const { data: discussion } = await supabase
      .from("prompt_discussions")
      .select("id, user_id, body, created_at")
      .eq("instance_id", instance.id)
      .order("created_at", { ascending: true });

    // Reactions exist only on revealed instances (RLS), so this read is
    // always post-reveal.
    const { data: reactionRows } = await supabase
      .from("answer_reactions")
      .select("user_id, target_user_id, question_id, emoji")
      .eq("instance_id", instance.id);
    const reactions = groupReactions(reactionRows ?? []);

    // Stable answer order: you first, then the other person.
    const ordered = [...(responses ?? [])].sort((a) =>
      a.user_id === user?.id ? -1 : 1,
    );

    return (
      <div className="page has-tabbar">
        <RevealWatcher instanceId={instance.id} />
        <Link href={`/connections/${connectionId}`} className="back-link">
          <Icon name="arrow-left" className="h-4 w-4" />
          Back
        </Link>

        {isFirstReveal ? (
          <header className="card-hero mt-4 overflow-hidden">
            <div aria-hidden className="blob -right-10 -top-10 h-40 w-40 bg-accent-200/60 dark:bg-accent-900/30" />
            <div aria-hidden className="blob -bottom-12 -left-8 h-40 w-40 bg-brand-300/50 dark:bg-brand-700/30" />
            <div className="relative">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center">
                  {ordered.map((r, i) => (
                    <Avatar
                      key={r.user_id}
                      name={avatarName(r.user_id)}
                      size="md"
                      variant={r.user_id === user?.id ? "you" : "them"}
                      className={i > 0 ? "-ml-2.5" : ""}
                    />
                  ))}
                </span>
                <p className="eyebrow">{heading}</p>
              </div>
              <h1 className="mt-4 text-display-md">{FIRST_REVEAL_UNLOCK.headline}</h1>
              <p className="mt-2 font-display text-xl text-brand-800 dark:text-brand-200">
                {FIRST_REVEAL_UNLOCK.subhead}
              </p>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-soft">
                {FIRST_REVEAL_UNLOCK.body}
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <a href="#answers" className="btn-primary">
                  {FIRST_REVEAL_UNLOCK.primaryCta}
                  <Icon name="arrow-right" className="h-4 w-4" />
                </a>
                <a href="#discussion" className="btn-secondary">
                  <Icon name="chat" className="h-4 w-4" />
                  {FIRST_REVEAL_UNLOCK.secondaryCta}
                </a>
                <ShareMilestone kind="first_reveal" count={questions.length} />
              </div>
              <Link
                href={`/connections/${connectionId}#today`}
                className="link mt-4 inline-block text-sm"
              >
                {FIRST_REVEAL_UNLOCK.tertiaryCta}
              </Link>
            </div>
          </header>
        ) : (
          <header className="mt-4">
            <p className="eyebrow">{heading}</p>
            <h1 className="mt-2 text-display-md">{REVEALED.headline}</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
              {REVEALED.body}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <a href="#discussion" className="btn-secondary btn-sm">
                <Icon name="chat" className="h-4 w-4" />
                {REVEALED.secondaryCta}
              </a>
              <ShareMilestone kind="reveal" />
              <Link
                href={`/connections/${connectionId}#today`}
                className="link text-sm"
              >
                {REVEALED.tertiaryCta}
              </Link>
            </div>
          </header>
        )}

        {scored && (
          <section className="card mt-10">
            <h2 className="text-lg">Your reflections</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Averages of your own scale answers, grouped by theme. A way to
              talk about how you each relate, not a diagnosis.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {ordered.map((r) => {
                const ref = quizReflection(questions, r.answers as AnswerMap);
                const mine = r.user_id === user?.id;
                return (
                  <div key={r.user_id} className={mine ? "answer-you" : "answer-them"}>
                    <p className="flex items-center gap-2 text-xs font-semibold text-ink-soft">
                      <Avatar name={avatarName(r.user_id)} size="xs" variant={mine ? "you" : "them"} ring={false} />
                      {nameOf(r.user_id)}
                    </p>
                    {ref ? (
                      <>
                        {ref.label && (
                          <p className="mt-2 font-display text-xl text-ink">{ref.label}</p>
                        )}
                        {ref.blurb && (
                          <p className="mt-1 text-sm text-ink-soft">{ref.blurb}</p>
                        )}
                        <ul className="mt-3 space-y-2 text-sm text-ink-soft">
                          {ref.scores.map((s) => (
                            <li key={s.dimension}>
                              <div className="flex justify-between gap-3">
                                <span>{dimensionLabel(s.dimension)}</span>
                                <span className="font-medium text-ink">
                                  {s.average} / {s.max}
                                </span>
                              </div>
                              <div className="progress-track mt-1 !h-1">
                                <div
                                  className={`h-full rounded-full ${mine ? "bg-brand-500" : "bg-accent-400"}`}
                                  style={{ width: `${Math.min(100, (s.average / s.max) * 100)}%` }}
                                />
                              </div>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <p className="mt-1 text-sm text-ink-faint">No scale answers.</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <ol id="answers" className="stagger mt-10 scroll-mt-24 space-y-5">
          {questions.map((q, i) => (
            <li key={q.id} className="card">
              <p className="eyebrow">Question {i + 1}{questions.length > 1 ? ` of ${questions.length}` : ""}</p>
              <p className="mt-1.5 font-display text-xl leading-snug text-ink">
                {q.text}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {ordered.map((r) => {
                  const mine = r.user_id === user?.id;
                  return (
                    <div key={r.user_id} className={mine ? "answer-you" : "answer-them"}>
                      <p className="flex items-center gap-2 text-xs font-semibold text-ink-soft">
                        <Avatar name={avatarName(r.user_id)} size="xs" variant={mine ? "you" : "them"} ring={false} />
                        {nameOf(r.user_id)}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-ink">
                        {(r.answers as AnswerMap)[q.id] || (
                          <span className="text-ink-faint">No answer</span>
                        )}
                      </p>
                      {(() => {
                        const got = reactions.get(reactionKey(r.user_id, q.id)) ?? [];
                        if (mine) {
                          // Their reaction to my answer, if any.
                          return got.length > 0 ? (
                            <p className="mt-2 text-sm" aria-label="Reactions to your answer">
                              {got.map((x) => (
                                <span
                                  key={x.user_id}
                                  className="mr-1 inline-block rounded-full border border-accent-200 bg-white/80 px-2 py-0.5 shadow-soft dark:border-accent-900/40 dark:bg-surface"
                                  title={`${nameOf(x.user_id)} reacted`}
                                >
                                  {x.emoji}
                                </span>
                              ))}
                            </p>
                          ) : null;
                        }
                        const my = got.find((x) => x.user_id === user?.id)?.emoji ?? null;
                        return (
                          <ReactionBar
                            instanceId={instance.id}
                            connectionId={connectionId}
                            targetUserId={r.user_id}
                            questionId={q.id}
                            mine={isReactionEmoji(my) ? my : null}
                          />
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            </li>
          ))}
        </ol>

        <section id="discussion" className="card mt-10 scroll-mt-24">
          <h2 className="flex items-center gap-2 text-lg">
            <Icon name="chat" className="h-5 w-5 text-brand-600 dark:text-brand-300" />
            Talk about it
          </h2>
          <ul className="mt-4 space-y-2.5">
            {(discussion ?? []).map((d) => {
              const mine = d.user_id === user?.id;
              return (
                <li
                  key={d.id}
                  className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}
                >
                  {!mine && <Avatar name={avatarName(d.user_id)} size="xs" variant="them" ring={false} />}
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                      mine
                        ? "rounded-br-md bg-brand-700 text-white dark:bg-brand-500"
                        : "rounded-bl-md bg-paper-warm text-ink"
                    }`}
                  >
                    {!mine && (
                      <p className="text-xs font-semibold text-brand-700 dark:text-brand-300">
                        {nameOf(d.user_id)}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap">{d.body}</p>
                  </div>
                </li>
              );
            })}
            {(!discussion || discussion.length === 0) && (
              <li className="rounded-2xl border border-dashed border-surface-line px-4 py-6 text-center text-sm text-ink-faint">
                No messages yet — start the conversation.
              </li>
            )}
          </ul>
          <DiscussionForm instanceId={instance.id} connectionId={connectionId} />
        </section>

        {isFirstReveal && !isPremium && <SoftPremiumCard />}
      </div>
    );
  }

  // ---- Waiting on them (you've answered; they haven't) ----
  if (answered && !othersAnswered) {
    return (
      <div className="page has-tabbar">
        <RevealWatcher instanceId={instance.id} />
        <Link href={`/connections/${connectionId}`} className="back-link">
          <Icon name="arrow-left" className="h-4 w-4" />
          Back
        </Link>
        <div className="card-warm mt-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-200">
              <Icon name="clock" className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="eyebrow">{heading}</p>
              <h1 className="mt-1 text-display-md">
                {partnerJoined ? WAITING_ON_THEM.headline : ANSWER_FIRST.answeredHeadline}
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
                {partnerJoined ? WAITING_ON_THEM.body : ANSWER_FIRST.answeredBody}
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {partnerJoined ? (
              <NudgePerson connectionUrl={connectionUrl} inviterName={myName} />
            ) : (
              <Link href={inviteHref} className="btn-primary">
                <Icon name="send" className="h-4 w-4" />
                {ANSWER_FIRST.answeredCta}
              </Link>
            )}
            <a href="#review-answers" className="btn-secondary">
              {WAITING_ON_THEM.secondaryCta}
            </a>
          </div>
          <p className="mt-4 text-sm text-ink-faint">{WAITING_ON_THEM.helper}</p>
        </div>

        <div id="review-answers" className="mt-10 scroll-mt-24">
          <h2 className="text-lg">{heading}</h2>
          <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-paper-warm px-3 py-1.5 text-sm text-ink-soft">
            <LockIcon />
            Still private — you can edit until they share too.
          </p>
          <AnswerForm
            instanceId={instance.id}
            connectionId={connectionId}
            userId={user?.id ?? "anon"}
            questions={questions}
            initialAnswers={myAnswers}
            answered={answered}
          />
        </div>
      </div>
    );
  }

  // ---- Waiting on you (they've answered; you haven't) ----
  if (!answered && othersAnswered) {
    return (
      <div className="page has-tabbar">
        <RevealWatcher instanceId={instance.id} />
        <Link href={`/connections/${connectionId}`} className="back-link">
          <Icon name="arrow-left" className="h-4 w-4" />
          Back
        </Link>
        <div className="card-hero mt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="eyebrow">{heading}</p>
            <span className="pill-action">Your turn</span>
          </div>
          <h1 className="mt-3 text-display-md">{WAITING_ON_YOU.headline}</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
            {WAITING_ON_YOU.body}
          </p>
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-paper-warm px-3 py-1.5 text-sm text-ink-soft">
            <LockIcon />
            {WAITING_ON_YOU.trustLine}
          </p>
          <div className="mt-5">
            <a href="#answer-form" className="btn-primary">
              {WAITING_ON_YOU.primaryCta}
              <Icon name="arrow-right" className="h-4 w-4" />
            </a>
          </div>
        </div>
        <div id="answer-form" className="mt-10 scroll-mt-24">
          <h2 className="text-lg">{heading}</h2>
          <AnswerForm
            instanceId={instance.id}
            connectionId={connectionId}
            userId={user?.id ?? "anon"}
            questions={questions}
            initialAnswers={myAnswers}
            answered={answered}
          />
        </div>
      </div>
    );
  }

  // ---- Empty / start answering (neither finished yet) ----
  return (
    <div className="page has-tabbar">
      <RevealWatcher instanceId={instance.id} />
      <Link href={`/connections/${connectionId}`} className="back-link">
        <Icon name="arrow-left" className="h-4 w-4" />
        Back
      </Link>
      <div className="mt-4">
        <p className="eyebrow">{heading}</p>
        <h1 className="mt-2 text-display-md">{EMPTY_STATE.headline}</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
          {EMPTY_STATE.body}
        </p>
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-paper-warm px-3 py-1.5 text-xs text-ink-soft">
          <LockIcon />
          {EMPTY_STATE.trustLine}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <a href="#answer-form" className="btn-primary">
            {EMPTY_STATE.primaryCta}
            <Icon name="arrow-right" className="h-4 w-4" />
          </a>
          {!partnerJoined && (
            <Link href={inviteHref} className="btn-secondary">
              <Icon name="send" className="h-4 w-4" />
              {EMPTY_STATE.secondaryCta}
            </Link>
          )}
        </div>
      </div>

      <div id="answer-form" className="mt-10 scroll-mt-24">
        <h2 className="text-lg">{heading}</h2>
        <AnswerForm
          instanceId={instance.id}
          connectionId={connectionId}
          userId={user?.id ?? "anon"}
          questions={questions}
          initialAnswers={myAnswers}
          answered={answered}
        />
      </div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 text-brand-600 dark:text-brand-300"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </svg>
  );
}
