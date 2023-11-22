import { ConflictException, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ShowtimeEntity } from './entity/showtime.entity';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { ShowtimeSummaryEntity } from './entity/showtimeSummary.entity';

@Injectable()
export class ShowtimeFixedService {
  constructor(
    @InjectRepository(ShowtimeEntity)
    private showtimeEntityRepository: Repository<ShowtimeEntity>,
    @InjectRepository(ShowtimeSummaryEntity)
    private showtimeSummaryEntityRepository: Repository<ShowtimeSummaryEntity>,
    private dataSource: DataSource
  ) {}

  /* This query is useless now as we implement counting in showtime table directly */
  //   private async updateShowtimeSummary() {
  //   }

  async addShowtimes(showtimes: ShowtimeInterface[]) {
    /*
        Fix:
        Firstly, all queries must be wrapped in a transaction and the transaction must be rolled back
        in case of an unexpected error not to introduce any inconsistency in the database. The changes
        will be auto committed if all database operations are successful.
        
        Secondly, whether to skip, replace or abort the operation depends on specific business requirements.
        However, I will abort the transaction as it is the safest option and ideally it should never occur.

        Also, If there's any query trying to insert duplicate values for the following rows: 'showtimeInUTC', 'cinemaName', 'movieTitle', 'attributes'
        I'm incremeneting the showtime count directly from "shotime" table which eliminates the need for the above query that writes into "shotimeSummary" table.

        Additionally, I'd normally use a bulk insert to optimize performance. But I'll leave this out for now
        for simplicity.

        Side note:
            I would normally remove showtimeId column and have database generate ids for me and create an index on respective columns
            to avoid duplicate showtime entries. With that setup, I would not have to worry about id duplication and would use an upsert query
            to increment the showtime count any time a duplicate record arrives which voilates unique constraint I added on "showtime" table. 
            But again, since I dont have enough context for showtimeId column's purpose I'll leave it as it is and just abort the transaction if
            showtimeId is duplicated. Lastly I'd also delete showtime-summary table as it's no longer needed.
    */
    await this.dataSource.transaction(async (manager) => {
      for (const showtime of showtimes) {
        try {
          await manager.query(
            `
              INSERT INTO "showtime" ("showtimeId", "movieTitle", "cinemaName", "showtimeInUTC", "bookingLink", "attributes", "showtimeCount")
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT ("showtimeInUTC", "cinemaName", "movieTitle", "attributes") DO
              UPDATE SET 
                "showtimeId" = EXCLUDED."showtimeId",
                "movieTitle" = EXCLUDED."movieTitle",
                "cinemaName" = EXCLUDED."cinemaName",
                "showtimeInUTC" = EXCLUDED."showtimeInUTC",
                "bookingLink" = EXCLUDED."bookingLink",
                "attributes" = EXCLUDED."attributes",
                "showtimeCount" = "showtime"."showtimeCount" + 1
            `,
            [
              showtime.showtimeId,
              showtime.movieTitle,
              showtime.cinemaName,
              showtime.showtimeInUTC,
              showtime.bookingLink,
              showtime.attributes,
              1,
            ]
          );
        } catch (err) {
          // Ideally I'd use some sort of logger service to persist the error message.
          // Bull I'll just console log here for simplicity
          console.log({
            message:
              'Failed to insert showtime due to potential duplicate id. Showtime id: ' +
              showtime.showtimeId,
            error: err,
          });

          // Throw the exception to abort the transaction
          throw new ConflictException({
            message:
              'Failed to insert showtime due to potential duplicate id. Showtime id: ' +
              showtime.showtimeId,
            entity: showtime,
          });
        }
      }
    });
  }
}
