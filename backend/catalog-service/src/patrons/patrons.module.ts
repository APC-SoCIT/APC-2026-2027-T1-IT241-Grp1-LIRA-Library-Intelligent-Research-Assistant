import { Module } from '@nestjs/common';
import { KohaModule } from '../koha/koha.module';
import { SupabaseUserGuard } from '../shared/supabase-user.guard';
import { PatronsController } from './patrons.controller';
import { PatronProvisioningService } from './patron-provisioning.service';
import { PatronListsController } from './patron-lists.controller';
import { PatronListsService } from './patron-lists.service';

@Module({
  imports: [KohaModule],
  controllers: [PatronsController, PatronListsController],
  providers: [PatronProvisioningService, PatronListsService, SupabaseUserGuard],
})
export class PatronsModule {}
