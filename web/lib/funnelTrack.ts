import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FIRST_QUESTION_ANSWERED,
  SIGN_UP_COMPLETED,
  scheduleFirstQuestionAnswered,
  scheduleSignUpCompleted,
  shouldTrackFunnelStep,
  type FunnelStep,
  type UserFunnelStep,
} from "@/lib/ga4";

/**
 * Once-only user funnel claim → anonymous GA4 MP via after().
 * Never throws into the auth redirect path.
 */
export async function claimAndTrackUserFunnelStep(
  supabase: SupabaseClient,
  step: UserFunnelStep,
): Promise<void> {
  try {
    const { data: claimed, error } = await supabase.rpc(
      "claim_user_funnel_step",
      { p_step: step },
    );
    if (error) {
      console.error("[ga4] claim_user_funnel_step failed", error.message);
      return;
    }
    if (shouldTrackFunnelStep(claimed === true)) {
      if (step === SIGN_UP_COMPLETED) scheduleSignUpCompleted();
    }
  } catch (err) {
    console.error("[ga4] claim_user_funnel_step failed", err);
  }
}

/**
 * Once-only connection funnel claim for first_question_answered.
 * Never throws into the submit path.
 */
export async function claimAndTrackFirstQuestionAnswered(
  supabase: SupabaseClient,
  connectionId: string,
): Promise<void> {
  const step: FunnelStep = FIRST_QUESTION_ANSWERED;
  try {
    const { data: claimed, error } = await supabase.rpc("claim_funnel_step", {
      p_connection_id: connectionId,
      p_step: step,
    });
    if (error) {
      console.error("[ga4] claim_funnel_step failed", error.message);
      return;
    }
    if (shouldTrackFunnelStep(claimed === true)) {
      scheduleFirstQuestionAnswered();
    }
  } catch (err) {
    console.error("[ga4] claim_funnel_step failed", err);
  }
}
