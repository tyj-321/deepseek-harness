# Agent Note: Windows plugin path arguments

Status: implemented

English | [中文](2026-10-13-windows-plugin-path-arguments.zh.md)

## Problem

Windows invokes the pnpm command shim through cmd.exe. Node joins shell arguments with spaces without quoting them, so a plugin path containing spaces or command separators can reach pnpm as multiple arguments.

## Decision

The [plugin launcher](../../../../apps/cli/src/plugin.ts) anchors local path specifications to the invoking directory before quoting shell arguments containing whitespace or cmd.exe separators. POSIX calls continue passing the argument array without a shell. Profile reconciliation still runs only after pnpm succeeds.

## Alternatives considered

Changing the install directory would exclude valid existing plugin paths. Applying Windows quotes to POSIX arguments would make quotes part of the package specification.

## Consequences

Local link specifications remain one pnpm argument even when the checkout path contains spaces and an ampersand. The built CLI acceptance test installs and removes such a local bundle through the profile command.
