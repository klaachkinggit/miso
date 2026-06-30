import * as React from "react";
import { Button, Section } from "@react-email/components";

import { colors, DetailRow, Layout, Paragraph } from "./Layout";

export interface PurchaseReceiptProps {
  eventName: string;
  category: string;
  quantity: number;
  amount: string;
  ticketsUrl: string;
}

export function PurchaseReceipt(props: PurchaseReceiptProps) {
  const plural = props.quantity > 1 ? "tickets" : "ticket";
  return (
    <Layout
      preview={`Your ${props.eventName} ${plural} are confirmed`}
      heading="Your tickets are confirmed"
    >
      <Paragraph>
        Thanks for your purchase. Your{" "}
        {props.quantity > 1 ? `${props.quantity} ` : ""}
        {plural} for <strong>{props.eventName}</strong>{" "}
        {props.quantity > 1 ? "have" : "has"} been minted to your wallet.
      </Paragraph>
      <Section style={{ margin: "0 0 18px" }}>
        <DetailRow label="Event" value={props.eventName} />
        <DetailRow label="Category" value={props.category} />
        <DetailRow label="Quantity" value={String(props.quantity)} />
        <DetailRow label="Amount paid" value={props.amount} />
      </Section>
      <Paragraph>
        Your {plural} live in your wallet — open them anytime to view the QR
        code for entry.
      </Paragraph>
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

export default PurchaseReceipt;
