import * as React from "react";
import { Button, Section } from "@react-email/components";

import { colors, DetailRow, Layout, Paragraph } from "./Layout";

export interface ResaleBoughtNoticeProps {
  eventName: string;
  amount: string;
  ticketsUrl: string;
}

export function ResaleBoughtNotice(props: ResaleBoughtNoticeProps) {
  return (
    <Layout
      preview={`Your ${props.eventName} resale purchase is confirmed`}
      heading="Resale purchase confirmed"
    >
      <Paragraph>
        Your resale purchase for <strong>{props.eventName}</strong> is confirmed and the ticket has
        been transferred to your wallet.
      </Paragraph>
      <Section style={{ margin: "0 0 18px" }}>
        <DetailRow label="Event" value={props.eventName} />
        <DetailRow label="Amount paid" value={props.amount} />
      </Section>
      <Button
        href={props.ticketsUrl}
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
        View my tickets
      </Button>
    </Layout>
  );
}

export default ResaleBoughtNotice;
