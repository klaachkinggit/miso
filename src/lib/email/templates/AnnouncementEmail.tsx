import * as React from "react";
import { Hr, Link, Text } from "@react-email/components";

import { colors, Layout, Paragraph } from "./Layout";

export interface AnnouncementEmailProps {
  organizationName: string;
  subject: string;
  body: string;
  unsubscribeUrl: string;
}

export function AnnouncementEmail(props: AnnouncementEmailProps) {
  return (
    <Layout preview={props.subject} heading={props.subject}>
      <Text style={{ fontSize: "13px", color: colors.muted, margin: "0 0 18px" }}>
        From {props.organizationName}
      </Text>
      {props.body.split(/\n{2,}/).map((para, index) => (
        <Paragraph key={index}>{para}</Paragraph>
      ))}
      <Hr style={{ borderColor: colors.border, margin: "24px 0 16px" }} />
      <Text style={{ fontSize: "12px", color: colors.muted, margin: 0 }}>
        You are receiving this because you follow {props.organizationName} on Miso.{" "}
        <Link href={props.unsubscribeUrl} style={{ color: colors.muted, textDecoration: "underline" }}>
          Unsubscribe
        </Link>
        .
      </Text>
    </Layout>
  );
}

export default AnnouncementEmail;
