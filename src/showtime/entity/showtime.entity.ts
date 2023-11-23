import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  OneToOne,
} from 'typeorm';
import { ShowtimeSummaryEntity } from './showtimeSummary.entity';

@Entity({ name: 'showtime', orderBy: { id: 'ASC' } })
/** Adding indexes to speed up the select query in updateShowtimeSummary() */
@Unique(['showtimeInUTC', 'cinemaName', 'movieTitle', 'attributes', 'city'])
export class ShowtimeEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: false, unique: true })
  showtimeId: string;

  @Column({ nullable: false })
  cinemaName: string;

  @Column({ nullable: false })
  movieTitle: string;

  @Column({ type: 'timestamptz', nullable: false })
  showtimeInUTC: Date;

  @Column({ nullable: false })
  bookingLink: string;

  @Column('varchar', { array: true, nullable: true })
  attributes: string[];

  @Column({ nullable: true, default: null })
  city: string;

  @OneToOne(() => ShowtimeSummaryEntity, (summary) => summary.showtime)
  summary: ShowtimeSummaryEntity;
}
