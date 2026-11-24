/// <reference path="../.astro/types.d.ts" />

import type { SafeUser } from './db/schema';

declare namespace App {
  interface Locals {
    user: SafeUser | null;
  }
}
