import * as React from "react";
import { Section } from "@react-email/components";

import { DetailRow, Layout, Paragraph } from "./Layout";

export interface WaitlistAvailableProps {
  eventName: string;
  eventUrl?: string;
}

export function WaitlistAvailable(props: WaitlistAvailableProps) {
  return (
    <Layout
      preview={`A ticket for ${props.eventName} just opened up`}
      heading="A ticket just opened up"
    >
      <Paragraph>
        Good news — a ticket for <strong>{props.eventName}</strong> may be
        available again, and you are next on the waitlist.
      </Paragraph>
      <Section style={{ margin: "0 0 18px" }}>
        <DetailRow label="Event" value={props.eventName} />
      </Section>
      <Paragraph>
        Tickets are first come, first served, so head over now to grab it before
        someone else does.
        {props.eventUrl ? " Use the link below to go straight there." : ""}
      </Paragraph>
    </Layout>
  );
}

export default WaitlistAvailable;
