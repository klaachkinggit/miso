import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

const ink = "#0b0b0f";
const paper = "#f4f4f5";
const muted = "#8a8a93";
const card = "#15151c";
const border = "#26262f";

export const colors = { ink, paper, muted, card, border, accent: "#7c5cff" };

export function Layout(props: {
  preview: string;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <Html>
      <Head />
      <Preview>{props.preview}</Preview>
      <Body
        style={{
          backgroundColor: ink,
          color: paper,
          margin: 0,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <Container style={{ maxWidth: "520px", margin: "0 auto", padding: "32px 20px" }}>
          <Text
            style={{
              fontSize: "14px",
              letterSpacing: "0.25em",
              color: muted,
              textTransform: "uppercase",
              margin: "0 0 24px",
            }}
          >
            Miso
          </Text>
          <Section
            style={{
              backgroundColor: card,
              border: `1px solid ${border}`,
              borderRadius: "14px",
              padding: "28px",
            }}
          >
            <Heading
              as="h1"
              style={{ fontSize: "22px", lineHeight: 1.3, margin: "0 0 16px", color: paper }}
            >
              {props.heading}
            </Heading>
            {props.children}
          </Section>
          <Text style={{ fontSize: "12px", color: muted, margin: "24px 0 0", textAlign: "center" }}>
            You are receiving this because of activity on your Miso account.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function Paragraph(props: { children: React.ReactNode }) {
  return (
    <Text style={{ fontSize: "15px", lineHeight: 1.6, color: colors.paper, margin: "0 0 14px" }}>
      {props.children}
    </Text>
  );
}

export function DetailRow(props: { label: string; value: string }) {
  return (
    <Text style={{ fontSize: "14px", color: colors.paper, margin: "0 0 6px" }}>
      <span style={{ color: colors.muted }}>{props.label}: </span>
      {props.value}
    </Text>
  );
}
