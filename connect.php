<?php 
$connect = new mysqli('localhost', 'root', '', 'dota');
if(!$connect)
{echo 'нет соединения с базой данных';}
?>