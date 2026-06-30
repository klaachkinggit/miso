import * as React from "react";
import { Button } from "@react-email/components";

import { colors, Layout, Paragraph } from "./Layout";

export interface PayoutReadyProps {
  dashboardUrl: string;
}

export function PayoutReady(props: PayoutReadyProps) {
  return (
    <Layout
      preview="Your Stripe payouts are ready — you can start selling"
      heading="You're ready to sell"
    >
      <Paragraph>
        Your Stripe onboarding is complete and your account can now accept
        charges and receive payouts.
      </Paragraph>
      <Paragraph>
        You can publish events and start selling tickets. Proceeds settle to
        your connected Stripe account on your payout schedule.
      </Paragraph>
      <Button
        href={props.dashboardUrl}
        style={{
          backgroundColor: colors.accent,
          color: "#ffffff",
          borderRadius: "10px",
          padding: "12px 22px",
          fontSize: "15px",
          textDecoration: "none",
          display: "inline-block",
        }}
      >
        Go to my dashboard
      </Button>
    </Layout>
  );
}

export default PayoutReady;
