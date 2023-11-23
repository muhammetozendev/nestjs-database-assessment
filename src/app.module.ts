import { Module } from '@nestjs/common';
import { ScraperModule } from './scraper/scraper.module';
import { ShowtimeModule } from './showtime/showtime.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShowtimeEntity } from './showtime/entity/showtime.entity';
import { ShowtimeSummaryEntity } from './showtime/entity/showtimeSummary.entity';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRootAsync({
      //TODO: Refactor this section to use the NestJS configuration management feature.
      // Avoid hardcoding sensitive information and use environment variables instead.
      // You may need to create a separate configuration module or use an existing one.
      // Ensure that the solution is scalable and environment agnostic.
      useFactory: (configService: ConfigService) => {
        return {
          type: 'postgres',
          host: configService.get('POSTGRES_HOST'),
          port: +configService.get('POSTGRES_PORT'),
          username: configService.get('POSTGRES_USER'),
          password: configService.get('POSTGRES_PASS'),
          database: 'scraper',
          entities: [ShowtimeEntity, ShowtimeSummaryEntity],
          synchronize: true,
          logging: true,
          migrations: ['dist/migrations/*.js'],
          migrationsRun: true,
        };
      },
      imports: [ConfigModule],
      inject: [ConfigService],
    }),
    ScraperModule,
    ShowtimeModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
