import * as React from "react";
import { Button, Section } from "@react-email/components";

import { colors, DetailRow, Layout, Paragraph } from "./Layout";

export interface EventPublishedProps {
  eventName: string;
  storefrontUrl: string;
}

export function EventPublished(props: EventPublishedProps) {
  return (
    <Layout
      preview={`${props.eventName} is now live`}
      heading="Your event is live"
    >
      <Paragraph>
        <strong>{props.eventName}</strong> is now published and live on Miso. Tickets are available
        for purchase.
      </Paragraph>
      <Section style={{ margin: "0 0 18px" }}>
        <DetailRow label="Event" value={props.eventName} />
      </Section>
      <Button
        href={props.storefrontUrl}
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
        View storefront
      </Button>
    </Layout>
  );
}

export default EventPublished;
