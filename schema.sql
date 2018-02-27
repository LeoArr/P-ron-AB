drop table if exists storages;
create table storages (
    name text primary key not null,
    idnr int not null,
    jtelefon int not null,
    jplatta int not null,
    paronklocka int not null
);

drop table if exists products;
create table products (
    name text primary key not null,
    idnr text not null,
    price int not null
);

drop table if exists transactions;
create table transactions (
    origin text not null,
    product text not null,
    amount int not null,
    transactiondate datetime not null
);
