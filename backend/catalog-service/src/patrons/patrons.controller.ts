import { Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedSupabaseUser, SupabaseUserGuard } from '../shared/supabase-user.guard';
import { PatronProvisioningService } from './patron-provisioning.service';

@Controller('api/patrons')
@UseGuards(SupabaseUserGuard)
export class PatronsController {
  constructor(private readonly provisioning: PatronProvisioningService) {}

  @Post('ensure-koha-account')
  ensureKohaAccount(@Req() request: Request & { supabaseUser: AuthenticatedSupabaseUser }) {
    return this.provisioning.ensurePatron(request.supabaseUser);
  }
}
