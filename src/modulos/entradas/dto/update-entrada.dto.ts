import { PartialType } from '@nestjs/swagger';
import { CreateEntradaDto } from './create-entrada.dto';

export class UpdateEntradaDto extends PartialType(CreateEntradaDto) {}
