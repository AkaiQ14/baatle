// Card Manager for Netlify compatibility
class CardManager {
  constructor() {
    this.cardDatabase = {
      common: [],
      epic: []
    };
    this.initializeCardDatabase();
  }

  initializeCardDatabase() {
    // Epic Cards (from Epic folder)
    this.cardDatabase.epic = [
      // Remove duplicates and keep unique entries
      ...[
        'images/A4thRaikagee.png',
        'images/Akainu.png',
        'images/Aokiji.png',
        'images/Aramaki.png',
        'images/Arthur-Pendragon.png',
        'images/Ban.png',
        'images/Bartolomeo.png',
        'images/Big-Mom.png',
        'images/Black-Zetsu.png',
        'images/Buggy.png',
        'images/Cathleen.png',
        'images/Chahe.png',
        'images/Choi-jong-in.png',
        'images/Chuya.png',
        'images/ColossialTitan.png',
        'images/Crocodile.png',
        'images/Dabi.png',
        'images/Dante.png',
        'images/Dazai.png',
        'images/Doflamingo.png',
        'images/Endeavor.png',
        'images/Eraserhead.png',
        'images/Eri.png',
        'images/Fuegoleon.png',
        'images/Fujitora.png',
        'images/Gaara.png',
        'images/Geto.png',
        'images/Gloxinia.png',
        'images/Go-Gunhee.png',
        'images/GTO.png',
        'images/Hachigen.png',
        'images/Hijikata.png',
        'images/HouKen.png',
        'images/Ichibe.png',
        'images/Ichigo.png',
        'images/Igris.png',
        'images/Iruka.png',
        'images/Johan.png',
        'images/Jotaro.png',
        'images/Judar.png',
        'images/Kabuto.png',
        'images/Kaguya.png',
        'images/Kaito.png',
        'images/Kensei.png',
        'images/Killua.png',
        'images/Koshiina.png',
        'images/Kuma.png',
        'images/Kurama.png',
        'images/Lemillion.png',
        'images/Leorio.png',
        'images/Lille-Baro.png',
        'images/Mansherry.png',
        'images/MaoMao.png',
        'images/Might-Guy.png',
        'images/Min-Byung-Gyu.png',
        'images/Minato.png',
        'images/Nami.png',
        'images/Nana.png',
        'images/Nanami.png',
        'images/Nero.png',
        'images/Orihime.png',
        'images/Oroshimaro.png',
        'images/Pain.png',
        'images/Rayleigh.png',
        'images/Reborn.png',
        'images/Sakura.png',
        'images/Sasuke.webm',
        'images/Senjumaru.png',
        'images/ShouHeiKun.png',
        'images/Teach.png',
        'images/Tengen.png',
        'images/Tobirama.png',
        'images/Tou.png',
        'images/Tsunade.png',
        'images/Tsunayoshi-Sawada.png',
        'images/Unohana.png',
        'images/Whis.png',
        'images/Yamato.png',
        'images/YoTanWa.png',
        'images/YujiroHanma.png',
        'images/Yumeko-Jabami.png',
        'images/Yusaku.png',
        'images/Yuta.png',
        'images/Zagred.png',
        'images/Goku-SSJ1.png',
        'images/Goku-SSJ3.png',
        'images/AizenCrow.webm',
        'images/Akai.webm',
        'images/AllMight.webm',
        'images/Alocard.webm',
        'images/Ayanokoji.webm',
        'images/Bakugo.webm',
        'images/Beru.webm',
        'images/Beerus.webm',
        'images/Broly.webm',
        'images/Cell.webm',
        'images/Chrollo.webm',
        'images/ErenCard.webm',
        'images/Garp.webm',
        'images/Gilgamesh.webm',
        'images/Gin.webm',
        'images/Gintoki.webm',
        'images/Gohan Beast.webm',
        'images/Goku Black.webm',
        'images/Goku-SSJ4.webm',
        'images/Goku-SSJB.webm',
        'images/Goku-SSJG.webm',
        'images/Hawks.webm',
        'images/Hinata.webm',
        'images/Ippo.webm',
        'images/Itachi.webm',
        'images/Jiraya.webm',
        'images/Kaido.webm',
        'images/KaitoKid.webm',
        'images/Kakashi.webm',
        'images/Kanki.webm',
        'images/Kyurak.webm',
        'images/Law.webm',
        'images/Lecht.webm',
        'images/Lelouch.webm',
        'images/Makima.webm',
        'images/Meliodas.webm',
        'images/Meruem.webm',
        'images/Midoriya.webm',
        'images/Naruto.webm',
        'images/Obito.webm',
        'images/Ouki.webm',
        'images/PrinceHata.webm',
        'images/Ran.png',
        'images/Ranppo.webm',
        'images/Rengoku.webm',
        'images/Riboku.webm',
        'images/Roger.webm',
        'images/SSJ2.webm',
        'images/Sonji.webm',
        'images/Sakamoto.webm',
        'images/Smiley.webm',
        'images/Sung-Jinwoo.webm',
        'images/Takamura.webm',
        'images/Toji.webm',
        'images/Todo.webm',
        'images/UmibozoCard.webm',
        'images/Ulquiorra.webm',
        'images/Utsuro.webm',
        'images/Vegito-Blue.webm',
        'images/Vermoth.webm',
        'images/Walker.webm',
        'images/Yamamoto.webm',
        'images/Yamato.webm',
        'images/Yhwach.webm',
        'images/Zaraki.webm',
        'images/Zeno.webm',
        'images/Zenon.webm',
        'images/zabuza.webm',
        'images/Aizen.webm',
        'images/AllForOne.webm',
        'images/Dio.webm',
        'images/Escanor.webm',
        'images/Gogeta.webm',
        'images/Goku-UI.webm',
        'images/Hashirama.webm',
        'images/LuffyGear5.webm',
        'images/Madara.webm',
        'images/Queen.webm',
        'images/Saitama.webm',
        'images/Yoriichi.webm',
        'images/ZORO.webm',
         'images/QG14.webm',
         'images/Roselle-Gustav.webm',
         'images/Shigaraki.webm',
         'images/Shikamaru.webm',
         'images/Smith.webm',
         'images/Azik.webm',
         'images/Giyuu.webm',
         'images/Hisoka.webm',
         'images/RockLee.webm',
         'images/Acnologia.png',
         'images/Conan.png',
         'images/Eustass-Kid.png',
         'images/Gounji.png',
         'images/Itadori.png',
         'images/Kurapika.png',
         'images/Nezuko.png',
         'images/Tanjiro.png',
         'images/Gojo.webm',
         'images/Urahara.webm',
         'images/Nezuko.png',
         'images/Rukia.webm',
         'images/Furuya.png',
         'images/Haibara.png',
         'images/foboki.webm',
         'images/Rimuru-Tempest.webm',
         'images/Vangeance.png',
         'images/Golden-Great-Ape.png',
         'images/Gon.png',
         'images/Akoi.png',
         'images/Fuegoleon.png',
         'images/Asta.png',
         'images/Shinobu.webm',
         'images/X.webm',
         'images/Shadow.webm',
         'images/Musashi.webm',
         'images/Muzan.webm',
         'images/Shanks.webm',
         'images/Akaza.png',
         'images/Killerbee.png',
         'images/LuffyGear2.png',
         'images/LuffyGear4BoundMan.png',
         'images/LuffyGear4SnakeMan.png',
         'images/LuffyGear4TankMan.png',
         'images/Todoroki.png',
         'images/Ace.webm',
         'images/Unahanaa.webm',
         'images/Lloyd-Fronter.webm',
         'images/Hiroto.webm',
         'images/Kidou.png',
         'images/Goku SS44.png',
         'images/Alya.webm',
         'images/heet.png',
         'images/isagi.png',
         'images/Akame.webm',
         'images/Sukuna.webm',
         'images/Silva Zoldyck.webm',
         'images/Frieren.png',
         'images/ZenoSama.webm',
         'images/WhiteBeard.webm',

      ].filter((card, index, self) => 
        self.indexOf(card) === index
      )
    ];

    // Common Cards (from Common folder)
    this.cardDatabase.common = [
      // Remove duplicates and keep unique entries
      ...[
        'images/Agasa.png',
        'images/Aizetsu.png',
        'images/Akari.png',
        'images/Akutagawa.png',
        'images/Alluka.png',
        'images/Android17.png',
        'images/Android18.png',
        'images/Android20.png',
        'images/ArmorTitan.png',
        'images/Asui.png',
        'images/Atsushi.png',
        'images/Atsuya.png',
        'images/Ayumi.png',
        'images/Bajio.png',
        'images/Bang.png',
        'images/Baraggan.png',
        'images/Baran.png',
        'images/Bardooock.png',
        'images/BazzB.png',
        'images/BeastKing.png',
        'images/BeastTitan.png',
        'images/Benn-Beckman.png',
        'images/Bepo.png',
        'images/Bisky.png',
        'images/Brook.png',
        'images/Buu.png',
        'images/Byakuya.png',
        'images/Caesar.png',
        'images/CartTitan.png',
        'images/Cavendish.png',
        'images/Charlotte-Roselei.png',
        'images/Charmyy.png',
        'images/Cheetu.png',
        'images/Cobra.png',
        'images/CouTou.png',
        'images/Crocus.png',
        'images/Dadan.png',
        'images/Dagon.png',
        'images/Derieri.png',
        'images/Diane.png',
        'images/Dodoriaa.png',
        'images/Dorothy.png',
        'images/DragonBB-123.png',
        'images/DragonBB-45.png',
        'images/DragonBB-67.png',
        'images/DukeHyou.png',
        'images/EdgeShot.png',
        'images/Eijiro.png',
        'images/EiSei.png',
        'images/Eso.png',
        'images/Fana.png',
        'images/Feitan.png',
        'images/FemaleTitan.png',
        'images/FingerBearer.png',
        'images/Franklin.png',
        'images/Franky-card.png',
        'images/Frieza.png',
        'images/Frost.png',
        'images/Fubuki.png',
        'images/Fumikage.png',
        'images/GaiMou.png',
        'images/Ganju.png',
        'images/Genthru.png',
        'images/Gin-Freecss.png',
        'images/Gin-Ichimaru.png',
        'images/Ginjo.png',
        'images/Ginta.png',
        'images/Glacier.png',
        'images/GoHouMei.png',
        'images/Gordon.png',
        'images/Gotenks.png',
        'images/GranTorino.png',
        'images/Grimmjow.png',
        'images/Gyutaro.png',
        'images/HakuKi.png',
        'images/Hanami.png',
        'images/Hancock.png',
        'images/Hanta.png',
        'images/Hantengu.png',
        'images/Hanzo.png',
        'images/Haruta.png',
        'images/Haschwalth.png',
        'images/Hawk.png',
        'images/Heiji.png',
        'images/Heki.png',
        'images/Hinamori.png',
        'images/Hinatsuri.png',
        'images/Hit.png',
        'images/Hiyori.png',
        'images/Hizashi.png',
        'images/Hotaru.png',
        'images/Hwang-Dongsoo.png',
        'images/Iida.png',
        'images/Ikkaku.png',
        'images/Inosuke.png',
        'images/Inumaki.png',
        'images/Ippo.png',
        'images/Iron.png',
        'images/Izuru.png',
        'images/Jack-the-Ripper.png',
        'images/Jack.png',
        'images/Jaw.png',
        'images/Jimbei.png',
        'images/Jogo.png',
        'images/Jozi.png',
        'images/Jozu.png',
        'images/Jugo.png',
        'images/Kagura.png',
        'images/Kale.png',
        'images/Kalluto.png',
        'images/Kaminari.png',
        'images/Kanae.png',
        'images/KanMei.png',
        'images/Kansuke.png',
        'images/Karaku.png',
        'images/KaRin.png',
        'images/Katsura.png',
        'images/Kazuho.png',
        'images/Kechizu.png',
        'images/KeiSha.png',
        'images/Kenzo.png',
        'images/Kinemon.png',
        'images/King-OPM.png',
        'images/KIng-SDS.png',
        'images/KingCold.png',
        'images/Kirach.png',
        'images/Knov.png',
        'images/KnuckledDuster.png',
        'images/Koichi.png',
        'images/Koji.png',
        'images/Komamura.png',
        'images/Komei.png',
        'images/Komugi.png',
        'images/Krilin.png',
        'images/Kyoga.png',
        'images/Kyogai.png',
        'images/Kyoukai.png',
        'images/Langris.png',
        'images/Leo.png',
        'images/Lilly.png',
        'images/Ma-Dongwook.png',
        'images/Magna.png',
        'images/Mai.png',
        'images/Maki-Zenen.png',
        'images/Makio.png',
        'images/Makoto.png',
        'images/ManGou.png',
        'images/Marco.png',
        'images/Mars.png',
        'images/Masamichi.png',
        'images/MasterRoshi.png',
        'images/Matsumoto.png',
        'images/Mechamaru.png',
        'images/MeiMei.png',
        'images/Melascula.png',
        'images/Merlin.png',
        'images/MetalBat.png',
        'images/Mezo.png',
        'images/Miguel.png',
        'images/Mikasa.png',
        'images/Mina.png',
        'images/Mitsu.png',
        'images/Mitsuri.png',
        'images/Miwa.png',
        'images/Momo-JJK.png',
        'images/MomoYaorozu.png',
        'images/Monet.png',
        'images/Monspeet.png',
        'images/MouGou.png',
        'images/Mouri.png',
        'images/MouTen.png',
        'images/MrSatan.png',
        'images/Nanao.png',
        'images/Nappa.png',
        'images/Neji.png',
        'images/Nejire.png',
        'images/Nemu.png',
        'images/Nighteye.png',
        'images/Nimaiya.png',
        'images/Noell.png',
        'images/Obanai.png',
        'images/Okabe.png',
        'images/Ordo.png',
        'images/Otama.png',
        'images/OuHou.png',
        'images/OuSen.png',
        'images/Overhaul.png',
        'images/PageOne.png',
        'images/Pakunda.png',
        'images/Palm.png',
        'images/Pan.png',
        'images/Panda.png',
        'images/Paragus.png',
        'images/Pedro.png',
        'images/Perospero.png',
        'images/Phinks.png',
        'images/Raditz.png',
        'images/RaiDo.png',
        'images/Rikido.png',
        'images/Rill.png',
        'images/Rin.png',
        'images/RinBuKun.png',
        'images/Robin.png',
        'images/Rojuro.png',
        'images/Rui.png',
        'images/Runge.png',
        'images/RyoFui.png',
        'images/Sabito.png',
        'images/Sabo.png',
        'images/Sado.png',
        'images/Sai.png',
        'images/SaikiK.png',
        'images/Sanemi.png',
        'images/Saul.png',
        'images/Sea-King.png',
        'images/SeiKai.png',
        'images/Sekido.png',
        'images/Sekke.png',
        'images/Sentomaru.png',
        'images/Shaka.png',
        'images/Shalapouf.png',
        'images/Shalnark.png',
        'images/Shinichi.png',
        'images/Shinjuro.png',
        'images/Shinpei.png',
        'images/Shisui.png',
        'images/Shizuku.png',
        'images/Shoot.png',
        'images/ShouBunKun.png',
        'images/Shouyou.png',
        'images/Shukuro-Tsukishima.png',
        'images/Silver.png',
        'images/Smoker.png',
        'images/SoiFon.png',
        'images/Soll.png',
        'images/SpeedSonic.png',
        'images/Stotz.png',
        'images/Subaru.png',
        'images/Suma.png',
        'images/Sung-chi-solo.png',
        'images/Susamaru.png',
        'images/Takuma.png',
        'images/Tamaki.png',
        'images/Tamayo.png',
        'images/Tenma.png',
        'images/Tenten.png',
        'images/Tessai.png',
        'images/TienShinhan.png',
        'images/Toga.png',
        'images/Tosen.png',
        'images/Toshiro.png',
        'images/Trunks.png',
        'images/Tusk.png',
        'images/Twice.png',
        'images/Ukitake.png',
        'images/Uraraka.png',
        'images/Urogi.png',
        'images/Urokodaki.png',
        'images/Utahime.png',
        'images/Uub.png',
        'images/Uvogin.png',
        'images/VanAugur.png',
        'images/Vanesa.png',
        'images/Vanica.png',
        'images/Vetto.png',
        'images/Videl.png',
        'images/Vista.png',
        'images/WarHammer.png',
        'images/WatchdogMan.png',
        'images/Wing.png',
        'images/WitchQueen.png',
        'images/Yamatcha.png',
        'images/Yamato.png',
        'images/Yoo-Jinho.png',
        'images/Yoruichi.png',
        'images/Yoshinobu.png',
        'images/Yuga.png',
        'images/Yumichika.png',
        'images/Zeff.png',
        'images/Zeno-kingdom.png',
        'images/Zohakuten.png',
        'images/Zora.png',
        'images/Syn-Shenron.png',
        'images/Super-Android-17.png',
        'images/Sidra.png',
        'images/Roasie.png',
        'images/Ribrianne.png',
        'images/Nuova-Shenron.png',
        'images/Majin-Kuu.png',
        'images/Majin-Duu.png',
        'images/Liquiir.png',
        'images/Lavender.png',
        'images/Kakunsa.png',
        'images/Heles.png',
        'images/Gomah.png',
        'images/Glorio.png',
        'images/Eis-Shenron.png',
        'images/Champa.png',
        'images/Bergamo.png',
        'images/Belmod.png',
        'images/Basil.png',
        'images/Anilaza.png',
        'images/Monaka.png',
        'images/Akiko-Yosano.png',
        'images/Best-Jeanist.png',
        'images/Baki.png',
        'images/Choso.png',
        'images/Elizabeth-Lione.png',
        'images/Fyodor.png',
        'images/Gaiche.png',
        'images/Galand.png',
        'images/Garo.png',
        'images/Illumi.png',
        'images/Ishida.png',
        'images/Jesus-Burgess.png',
        'images/Karin-Uzumaki.png',
        'images/Kefla.png',
        'images/KingKai.png',
        'images/Kirio.png',
        'images/KiSui.png',
        'images/Knuckle.png',
        'images/Kurogiri.png',
        'images/Liebe.png',
        'images/Lord-Boros.png',
        'images/Luck.png',
        'images/Machi.png',
        'images/Mahito.png',
        'images/Mayuri.png',
        'images/Megumi.png',
        'images/Meleoron.png',
        'images/Mihawk.png',
        'images/Mimosa.png',
        'images/Mirko.png',
        'images/Mob.png',
        'images/Momonosuke.png',
        'images/Morel.png',
        'images/Moria.png',
        'images/MouBu.png',
        'images/Nacht.png',
        'images/Naobito.png',
        'images/Nobara.png',
        'images/Nobunaga.png',
        'images/Nozel.png',
        'images/Oden.png',
        'images/Pariston.png',
        'images/Piccolo.png',
        'images/Razor.png',
        'images/Renji.png',
        'images/RenPa.png',
        'images/Rhya.png',
        'images/RiShin.png',
        'images/Ryuma.png',
        'images/Sanji.png',
        'images/Scopper-Gaban.png',
        'images/Shinji.png',
        'images/Shizune.png',
        'images/Shoko.png',
        'images/Stain.png',
        'images/Stark.png',
        'images/Tank.png',
        'images/Temari.png',
        'images/Tokito.png',
        'images/Toppo.png',
        'images/Ulquiorra.png',
        'images/Undine.png',
        'images/Uraume.png',
        'images/Yuki.png',
        'images/Yuno.png',
        'images/Youpi.png',
        'images/Zamasu.png',
        'images/Zeldris.png',
        'images/Aphrodi.png',
        'images/Nagomo.png',
        'images/Endou.png',
        'images/Ranma.png',
        'images/Haku.png',
        'images/Dyspo.png',
        'images/Vados.png',
        'images/Baby.png',
        'images/Marcarita.png',
        'images/Adult-Gon.png',
        'images/Chopper.png',
        'images/Kenjaku.png',
        'images/Kokushibo.png',
        'images/Konohamaru.png',
        'images/Luffy-Nightmare.png',
        'images/Kaneki.png',
        'images/susano.png',
        'images/Violet.png',
        'images/Goku-Base.webp',
        'images/Goku-Kid.webp',
        'images/Goku-Great-Ape.png',
        'images/Luffy-Gear3.png',
        'images/Luffy-Timeskip.png',
        'images/Luffy-PreTimeskip.png',
        'images/Nanika.png',
        'images/Rika.png',
        'images/tobit.png',
        'images/Kaze.png',
        'images/Fudo.png',
        'images/Asuma.png',
        'images/Benimaru-Shinmon.png',
        'images/Choji.png',
        'images/Deidara.png',
        'images/Hidan.png',
        'images/Hiruzen.png',
        'images/Indra.png',
        'images/Isshin.png',
        'images/Kisame.png',
        'images/Levi.png',
        'images/Mei.png',
        'images/Pizarro.png',
        'images/Rob-Lucci.png',
        'images/Roy-Mustang.png',
        'images/Sasori.png',
        'images/Alex-Louis-Armstrong.png',
'images/Ameyuri.png',
'images/Aquarius.png',
'images/Asura.png',
'images/blastoise.png',
'images/Caribou.png',
'images/Darui.png',
'images/Denki.png',
'images/edward-elric.png',
'images/Elfaria-Albis.png',
'images/Emilia.png',
'images/esdeath.png',
'images/Fu.png',
'images/Fuyumi.png',
'images/Gadjah.png',
'images/Gajeel.png',
'images/Gamabunta.png',
'images/Geten.png',
'images/Ghiaccio.png',
'images/Gild-Tesoro.png',
'images/Gilthunder.png',
'images/Gray-Fullbuster.png',
'images/Gyarados-blue.png',
'images/Hanami.png',
'images/Heath-graice.png',
'images/Hiashi.png',
'images/Hyssop.png',
'images/Ino.png',
'images/Isaac-Mcdougal.png',
'images/Jimbei.png',
'images/Jirobo.png',
'images/Julius-wistoria.png',
'images/Juvia-Loxar.png',
'images/Kamizuki-Izumo.png',
'images/Kankuro.png',
'images/KarimFlam.png',
'images/Kiba.png',
'images/Kimimaro.png',
'images/Konan.png',
'images/Kota-Izumi.png',
'images/Kurenai.png',
'images/Laxus.png',
'images/Lihanna.png',
'images/Lumiere-Silvamillion.png',
'images/Lyon-Vastia.png',
'images/Manual.png',
'images/Mariella.png',
'images/Mashle.png',
'images/Momo-hinamori.png',
'images/Natsu.png',
'images/onoki.png',
'images/Pet-Shop.png',
'images/Pica.png',
'images/Pikachu.png',
'images/poseidon.png',
'images/Prince-Grus.png',
'images/roshi.png',
'images/Shino.png',
'images/Shinra.png',
'images/Suigetsu.png',
'images/thor.png',
'images/Toya.png',
'images/Ultear-Milkovich.png',
'images/Ur.png',
'images/Utakata.png',
'images/Yagura.png',
        
      ].filter((card, index, self) => 
        self.indexOf(card) === index
      )
    ];
  }


  // Generate random cards for a player
  generateRandomCards(totalCards = 20) {
    // If no cards are available, return an empty array
    if (this.getAllCards().length === 0) {
      console.warn('No cards available to generate random selection.');
      return [];
    }

    const selectedCards = [];
    const usedCards = new Set();

    // Dynamic card distribution with updated percentages
    const baseDistribution = {
      common: 0.60,      // 60%
      epic: 0.40,        // 40%
      rare: 0.00,        // 0%
      legendary: 0.00,   // 0%
      ultimate: 0.00,    // 0%
      cursed: 0.00       // 0%
    };

    // Add small random variations to percentages
    const variationFactor = 0.05; // 5% variation
    const dynamicDistribution = {};

    for (const [category, basePercentage] of Object.entries(baseDistribution)) {
      // Generate a random variation between -5% and +5%
      const variation = (Math.random() * 2 - 1) * variationFactor;
      dynamicDistribution[category] = Math.max(0, basePercentage + variation);
    }

    // Normalize to ensure total is 1
    const total = Object.values(dynamicDistribution).reduce((a, b) => a + b, 0);
    for (const category in dynamicDistribution) {
      dynamicDistribution[category] /= total;
    }

    // Convert to card counts
    const cardDistribution = {
      common: Math.floor(totalCards * 0.60),     // 60%
      epic: Math.floor(totalCards * 0.40),       // 40%
      rare: 0,       // 0%
      legendary: 0,  // 0%
      ultimate: 0,   // 0%
      cursed: 0      // 0%
    };

    // Adjust for rounding errors
    const totalDistributed = Object.values(cardDistribution).reduce((a, b) => a + b, 0);
    if (totalDistributed < totalCards) {
      cardDistribution.common += (totalCards - totalDistributed);
    }

    console.log('🎲 Dynamic Card Distribution:', cardDistribution);

    // Distribute card selection across available card types
    const cardTypes = [
      { type: this.cardDatabase.common, name: 'common', count: cardDistribution.common },
      { type: this.cardDatabase.rare, name: 'rare', count: cardDistribution.rare },
      { type: this.cardDatabase.epic, name: 'epic', count: cardDistribution.epic },
      { type: this.cardDatabase.legendary, name: 'legendary', count: cardDistribution.legendary },
      { type: this.cardDatabase.ultimate, name: 'ultimate', count: cardDistribution.ultimate },
      { type: this.cardDatabase.cursed, name: 'cursed', count: cardDistribution.cursed },
      { type: this.cardDatabase.mythic, name: 'mythic', count: cardDistribution.mythic }
    ];

    // Shuffle card types to add more randomness
    const shuffledTypes = cardTypes
      .filter(typeObj => typeObj.type.length > 0 && typeObj.count > 0)
      .sort(() => Math.random() - 0.5);

    // If no card types have cards, return an empty array
    if (shuffledTypes.length === 0) {
      console.warn('No card types have any cards.');
      return [];
    }

    // Multiple shuffling techniques
    const shuffleMethods = [
      (arr) => arr.sort(() => Math.random() - 0.5),
      (arr) => {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      },
      (arr) => arr.slice().sort((a, b) => Math.random() - 0.5)
    ];

    // Distribute cards across types
    for (const typeObj of shuffledTypes) {
      // Randomly choose a shuffle method
      const shuffleMethod = shuffleMethods[Math.floor(Math.random() * shuffleMethods.length)];
      
      // Shuffle the current card type
      const shuffledCards = shuffleMethod([...typeObj.type]);
      
      // Select cards from this type
      for (const card of shuffledCards) {
        if (selectedCards.length >= totalCards) break;
        
        if (!usedCards.has(card)) {
          selectedCards.push(card);
          usedCards.add(card);
        }
      }
    }

    // If we still haven't reached the total number of cards, fill with random cards
    while (selectedCards.length < totalCards) {
      const allCards = this.getAllCards();
      const randomCard = allCards[Math.floor(Math.random() * allCards.length)];
      
      if (!usedCards.has(randomCard)) {
        selectedCards.push(randomCard);
        usedCards.add(randomCard);
      }
    }

    // Final shuffle
    return selectedCards.sort(() => Math.random() - 0.5);
  }

  // Create media element (image or video)
  createMediaElement(url, className, onClick) {
    // Use the URL as-is since all cards are in the images/ directory
    const isWebm = /\.webm(\?|#|$)/i.test(url);
    
    if (isWebm) {
      const video = document.createElement("video");
      video.src = url;
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.className = className;
      video.style.border = "none";
      video.style.borderRadius = "0px";
      video.style.objectFit = "contain";
      if (onClick) video.onclick = onClick;
      return video;
    } else {
      const img = document.createElement("img");
      img.src = url;
      img.className = className;
      img.style.border = "none";
      img.style.borderRadius = "0px";
      img.style.objectFit = "contain";
      if (onClick) img.onclick = onClick;
      return img;
    }
  }

  // Validate card path and return corrected path
  validateCardPath(path) {
    if (!path || typeof path !== 'string') {
      return null;
    }

    // Convert old paths to new images/ directory structure
    let correctedPath = path;
    
    // Remove any CARD/ prefix
    correctedPath = correctedPath.replace(/^CARD\//, '');
    
    // Convert old directory structure to new images/ structure
    if (correctedPath.startsWith('Common/')) {
      correctedPath = correctedPath.replace('Common/', 'images/');
    } else if (correctedPath.startsWith('Epic/')) {
      correctedPath = correctedPath.replace('Epic/', 'images/');
    } else if (correctedPath.startsWith('Legendray/')) {
      correctedPath = correctedPath.replace('Legendray/', 'images/');
    } else if (!correctedPath.startsWith('images/') && !correctedPath.startsWith('http')) {
      // If it doesn't start with images/ and isn't a full URL, add images/ prefix
      correctedPath = 'images/' + correctedPath;
    }
    
    // Fix common naming inconsistencies
    correctedPath = correctedPath
      .replace(/-card\.(png|webp|webm)/g, '.$1')
      .replace(/_card\.(png|webp|webm)/g, '.$1')
      .replace(/cardo20ppsd\.webp/g, 'cardo20ppsd.webp')
      .replace(/Vegapunk-crad\.webp/g, 'Vegapunk-crad.webp');

    return correctedPath;
  }

  // Clear old localStorage data
  clearOldData() {
    try {
      // Clear old card data that might have wrong paths
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.includes('StrategicPicks') || key.includes('StrategicOrdered')) {
          localStorage.removeItem(key);
          console.log('Cleared old data:', key);
        }
      });
    } catch (e) {
      console.error('Error clearing old data:', e);
    }
  }

  // Load cards from localStorage with fallback
  loadPlayerCards(playerParam) {
    const PICKS_LOCAL_KEY = `${playerParam}StrategicPicks`;
    
    try {
      // Try to load from localStorage first
      const savedPicks = JSON.parse(localStorage.getItem(PICKS_LOCAL_KEY) || '[]');
      
      if (Array.isArray(savedPicks) && savedPicks.length > 0) {
        const cards = savedPicks.map(card => {
          if (typeof card === 'string') {
            return this.validateCardPath(card);
          }
          if (card && card.src) {
            return this.validateCardPath(card.src);
          }
          return null;
        }).filter(Boolean);
        
        if (cards.length > 0) {
          console.log('Loaded cards from localStorage:', cards);
          return cards;
        }
      }
    } catch (e) {
      console.error('Error loading cards from localStorage:', e);
    }

    // Fallback: generate random cards
    console.log('Generating random cards as fallback');
    return this.generateRandomCards(20);
  }

  // Save cards to localStorage
  savePlayerCards(playerParam, cards) {
    const PICKS_LOCAL_KEY = `${playerParam}StrategicPicks`;
    
    try {
      localStorage.setItem(PICKS_LOCAL_KEY, JSON.stringify(cards));
      console.log('Saved cards to localStorage:', cards);
    } catch (e) {
      console.error('Error saving cards to localStorage:', e);
    }
  }

  // Get all available cards by category
  getAllCardsByCategory(category) {
    return this.cardDatabase[category] || [];
  }

  // Get all available cards
  getAllCards() {
    return [
      ...this.cardDatabase.common,
      ...this.cardDatabase.epic
    ];
  }
}

// Create global instance
window.cardManager = new CardManager();

