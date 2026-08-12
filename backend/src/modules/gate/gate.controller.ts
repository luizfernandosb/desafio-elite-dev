import type { Request, Response } from 'express'
import type { ValidateDto } from './gate.schema'
import type { GateService } from './gate.service'

export class GateController {
  constructor(private readonly service: GateService) {}

  // sempre 200 -- os quatro (na verdade oito) resultados são operacionalmente
  // esperados, não erros da requisição (§ etapa 10, decisão de contrato)
  validate = async (req: Request, res: Response) => {
    const result = await this.service.validate(req.user!.id, req.body as ValidateDto, req.log)
    res.status(200).json(result)
  }

  stats = async (req: Request, res: Response) => {
    const stats = await this.service.stats(req.params.id as string)
    res.json(stats)
  }
}
