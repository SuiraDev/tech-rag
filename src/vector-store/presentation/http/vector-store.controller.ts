import { Body, Controller, Post } from '@nestjs/common';
import { VectorStoreService } from '../../application/vector-store.service';
import type { SearchVectorStoreRequestDto } from './dto/search-vector-store-request.dto';

@Controller('vector-store')
export class VectorStoreController {
  constructor(private readonly vectorStoreService: VectorStoreService) {}

  @Post('initialize')
  initialize() {
    return this.vectorStoreService.initialize();
  }

  @Post('search')
  search(@Body() body: SearchVectorStoreRequestDto) {
    return this.vectorStoreService.search(body.query, body.limit);
  }
}
