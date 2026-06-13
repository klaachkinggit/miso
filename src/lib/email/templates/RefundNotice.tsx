import * as React from "react";
import { Section } from "@react-email/components";

import { DetailRow, Layout, Paragraph } from "./Layout";

export interface RefundNoticeProps {
  eventName: string;
  amount: string;
  reason?: string | null;
}

export function RefundNotice(props: RefundNoticeProps) {
  return (
    <Layout
      preview={`A refund was issued for ${props.eventName}`}
      heading="Your refund has been issued"
    >
      <Paragraph>
        A refund has been issued for your <strong>{props.eventName}</strong> purchase.
      </Paragraph>
      <Section style={{ margin: "0 0 18px" }}>
        <DetailRow label="Event" value={props.eventName} />
        <DetailRow label="Refunded amount" value={props.amount} />
        {props.reason ? <DetailRow label="Reason" value={props.reason} /> : null}
      </Section>
      <Paragraph>
        The refund will appear on your original payment method within a few business days, subject to
        your bank&apos;s processing times.
      </Paragraph>
    </Layout>
  );
}

export default RefundNotice;
