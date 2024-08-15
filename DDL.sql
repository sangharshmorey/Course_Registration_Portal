drop EXTENSION if exists pgcrypto;
drop table if exists sql_injection_dummy;
drop table if exists loginuser;
drop type if exists role_enum;
drop table if exists prereq;
drop table if exists takes;
drop table if exists student;
drop table if exists teaches;
drop table if exists section;
drop table if exists instructor;
drop table if exists course;

create table course
	(course_id		varchar(8), 
	 title			varchar(50), 
	 credits		numeric(2,0) check (credits > 0),
	 primary key (course_id)
	);

create table instructor
	(ID			varchar(6), 
	 name			varchar(20) not null, 
	 primary key (ID)
	);

create table section
	(course_id		varchar(8), 
         sec_id			varchar(8),
	 semester		varchar(6)
		check (semester in ('Fall', 'Winter', 'Spring', 'Summer')), 
	 year			numeric(4,0) check (year > 1701 and year < 2100), 
	 registration_limit integer,
	 primary key (course_id, sec_id, semester, year),
	 foreign key (course_id) references course
		on delete cascade
	);

create table teaches
	(ID			varchar(6), 
	 course_id		varchar(8),
	 sec_id			varchar(8), 
	 semester		varchar(6),
	 year			numeric(4,0),
	 primary key (ID, course_id, sec_id, semester, year),
	 foreign key (course_id,sec_id, semester, year) references section
		on delete cascade,
	 foreign key (ID) references instructor
		on delete cascade
	);

create table student
	(ID			varchar(6), 
	 name			varchar(20) not null, 
	 primary key (ID)
	);

create table takes
	(ID			varchar(6), 
	 course_id		varchar(8),
	 sec_id			varchar(8), 
	 semester		varchar(6),
	 year			numeric(4,0),
	 grade		        varchar(2),
	 primary key (ID, course_id, sec_id, semester, year),
	 foreign key (course_id,sec_id, semester, year) references section
		on delete cascade,
	 foreign key (ID) references student
		on delete cascade
	);

create table prereq
	(course_id		varchar(8), 
	 prereq_id		varchar(8),
	 primary key (course_id, prereq_id),
	 foreign key (course_id) references course
		on delete cascade,
	 foreign key (prereq_id) references course
	);

create type role_enum as ENUM ('instructor', 'student', 'admin');

create table loginuser
	( id	serial primary key,
	  role	role_enum,
	  ins_id	varchar(6),
	  stud_id	varchar(6),
	  admin_id	varchar(6),
	  password_hash	varchar,
	  foreign key (ins_id) references instructor on delete set null,
	  foreign key (stud_id) references student on delete set null
	);

create table sql_injection_dummy (
    id serial primary key
);

create EXTENSION if not exists pgcrypto;