// src/modules/campaigns/processors/dispatch.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DispatchService } from '../dispatch.service';

@Processor('sms-dispatch', {
  concurrency: 10, // processa 10 SMS simultaneamente
})
export class DispatchProcessor extends WorkerHost {
  private readonly logger = new Logger(DispatchProcessor.name);

  constructor(private dispatch: DispatchService) {
    super();
  }

  async process(job: Job) {
    const { messageId, tenantId, phone, body } = job.data;
    this.logger.debug(`Processando job ${job.id} — SMS para ${phone}`);

    try {
      const result = await this.dispatch.processJob(messageId, tenantId, phone, body);
      this.logger.debug(`Job ${job.id} concluído. Sucesso: ${result.success}`);
      return result;
    } catch (error) {
      this.logger.error(`Job ${job.id} falhou: ${error.message}`);
      throw error; // BullMQ reencaminha para retry automático
    }
  }
}
