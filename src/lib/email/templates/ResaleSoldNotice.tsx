import * as React from "react";
import { Section } from "@react-email/components";

import { DetailRow, Layout, Paragraph } from "./Layout";

export interface ResaleSoldNoticeProps {
  eventName: string;
  listingPrice: string;
}

export function ResaleSoldNotice(props: ResaleSoldNoticeProps) {
  return (
    <Layout
      preview={`Your ${props.eventName} ticket sold`}
      heading="Your ticket sold"
    >
      <Paragraph>
        Good news — your resale listing for <strong>{props.eventName}</strong> has sold.
      </Paragraph>
      <Section style={{ margin: "0 0 18px" }}>
        <DetailRow label="Event" value={props.eventName} />
        <DetailRow label="Listing price" value={props.listingPrice} />
      </Section>
      <Paragraph>
        Your payout (listing price net of the marketplace fee and any organizer royalty) is on its
        way to your connected Stripe account. Payout timing follows your Stripe payout schedule.
      </Paragraph>
    </Layout>
  );
}

export default ResaleSoldNotice;
