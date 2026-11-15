# Hanzi stroke data

`medians.json`: stroke centrelines in stroke order for 9,574 Chinese characters, keyed by character.
Each value is `stroke|stroke|…`, each stroke `x,y x,y …` on a 512 grid (y up, bottom of the em box at y=−62, top at 450).

Derived from `graphics.txt` of [Make Me a Hanzi](https://github.com/skishore/makemeahanzi) (medians only,
coordinates halved), which is itself derived from the Arphic PL KaitiM GB and Arphic PL UKai fonts.
Redistributed under the **Arphic Public License** (`LICENSE-APL.txt`). The rest of this skill stays MIT.
