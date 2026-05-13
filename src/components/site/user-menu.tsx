"use client";

import { LogOut, UserCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatPrice } from "@/lib/format";
import type { AccountBalance, Profile } from "@/types/db";

export function UserMenu({
  profile,
  balances,
}: {
  profile: Profile;
  balances: AccountBalance[];
}) {
  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="min-w-0">
          <UserCircle className="h-4 w-4" />
          <span className="hidden max-w-32 truncate sm:inline">
            {profile.display_name ?? profile.email}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <span className="block truncate">{profile.email}</span>
          <span className="block text-xs font-normal text-muted-foreground">
            {profile.role}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {profile.role !== "controller" ? (
          <>
            <DropdownMenuLabel className="font-normal">
              <span className="block text-xs font-medium uppercase text-muted-foreground">Balance</span>
              {balances.length ? (
                <span className="mt-1 block text-sm">
                  {balances.map((balance) => formatPrice(balance.available_amount, balance.currency)).join(" / ")}
                </span>
              ) : (
                <span className="mt-1 block text-sm">0 MAD</span>
              )}
            </DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link href="/balance">Account Balance</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
